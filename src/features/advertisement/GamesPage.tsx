import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { HyperspinPlatformTheme } from "../../services/hyperspinPlatformThemesService";
import {
  listHyperspinGames,
  type HyperspinGame,
} from "../../services/hyperspinGamesService";
import { launchSelectedGame } from "../../services/emulatorLauncher";
import { Spinner } from "../../components/spinner/Spinner";
import { usePlaySession } from "./session/PlaySessionContext";
import { HyperspinWheel } from "./HyperspinWheel";
import { recordGameLaunch } from "../../services/db/usage";
import {
  getStatsForPlatform,
  setFavorite,
  type GameStat,
} from "../../services/db/gameStats";

type FilterMode = "all" | "favorites" | "mostplayed";
type SortMode = "az" | "plays" | "year";

type GamesPageLocationState = {
  platform: HyperspinPlatformTheme;
};

function GameBackground({ game }: { game: HyperspinGame | null }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !game?.videoUrl) return;

    video.load();
    void video.play().catch(() => {});
  }, [game?.videoUrl]);

  if (!game) {
    return <div className="absolute inset-0 bg-black" />;
  }

  if (game.videoUrl) {
    return (
      <video
        ref={videoRef}
        key={game.videoUrl}
        src={game.videoUrl}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        // muted
        loop
        playsInline
        controls={false}
      />
    );
  }

  if (game.backgroundImageUrl) {
    return (
      <img
        src={game.backgroundImageUrl}
        alt={game.description}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
    );
  }

  if (game.wheelImageUrl) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <img
          src={game.wheelImageUrl}
          alt={game.description}
          className="max-h-[70%] max-w-[70%] object-contain opacity-90"
          draggable={false}
        />
      </div>
    );
  }

  return <div className="absolute inset-0 bg-black" />;
}

export function GamesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as GamesPageLocationState | null) ?? null;
  const platform = state?.platform ?? null;
  const { canPlay, status, resetSession } = usePlaySession();

  const [games, setGames] = useState<HyperspinGame[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loadingGames, setLoadingGames] = useState(true);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [launchingGameName, setLaunchingGameName] = useState<string | null>(
    null,
  );
  const [keyboardUnlockAt, setKeyboardUnlockAt] = useState(0);
  const [stats, setStats] = useState<Record<string, GameStat>>({});
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<SortMode>("az");

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const loadStats = useCallback(async () => {
    if (!platform) return;
    setStats(await getStatsForPlatform(platform.name));
  }, [platform]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    const handleWindowFocus = () => {
      // Evita que teclas usadas no emulador (ex.: Enter/Esc)
      // disparem ações acidentais ao devolver foco para o app.
      setKeyboardUnlockAt(Date.now() + 450);
    };

    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, []);
  useEffect(() => {
    if (status !== "expired") return;

    invoke("stop_active_game").catch((error) => {
      console.error("Erro ao encerrar jogo ativo:", error);
    });
    navigate("/", { replace: true });
    resetSession();
  }, [navigate, resetSession, status]);

  const genres = useMemo(() => {
    const set = new Set<string>();
    for (const g of games) {
      if (g.genre) set.add(g.genre);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [games]);

  const filteredGames = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    let list = games.filter((game) => {
      if (normalizedSearch) {
        const haystack = [
          game.description,
          game.name,
          game.manufacturer ?? "",
          game.genre ?? "",
          game.year ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }

      if (genreFilter !== "all" && game.genre !== genreFilter) return false;

      const stat = stats[game.name];
      if (filterMode === "favorites" && !stat?.favorite) return false;
      if (filterMode === "mostplayed" && !(stat?.playCount ?? 0)) return false;

      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortMode === "plays") {
        return (stats[b.name]?.playCount ?? 0) - (stats[a.name]?.playCount ?? 0);
      }
      if (sortMode === "year") {
        return (Number(b.year) || 0) - (Number(a.year) || 0);
      }
      return a.description.localeCompare(b.description, undefined, {
        numeric: true,
      });
    });

    return list;
  }, [games, searchTerm, genreFilter, filterMode, sortMode, stats]);

  const selectedGame = useMemo(() => {
    if (filteredGames.length === 0) return null;
    return (
      filteredGames[Math.min(selectedIndex, filteredGames.length - 1)] ?? null
    );
  }, [filteredGames, selectedIndex]);

  const wheelItems = useMemo(
    () =>
      filteredGames.map((game) => ({
        key: game.name,
        label: game.description,
        imageUrl: game.wheelImageUrl,
        dim: !game.hasRom,
      })),
    [filteredGames],
  );

  const safeSelectedIndex =
    filteredGames.length === 0
      ? 0
      : Math.min(selectedIndex, filteredGames.length - 1);

  const loadGames = useCallback(async () => {
    if (!platform) return;

    setLoadingGames(true);
    setGamesError(null);

    try {
      const items = await listHyperspinGames({
        platformName: platform.name,
      });

      setGames(items);
      setSelectedIndex(0);
    } catch (error) {
      console.error("Erro real ao ler jogos do HyperSpin:", error);
      setGames([]);
      setGamesError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingGames(false);
    }
  }, [platform]);

  useEffect(() => {
    void loadGames();
  }, [loadGames]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm, genreFilter, filterMode, sortMode]);

  const selectedGameForFav = filteredGames[safeSelectedIndex] ?? null;

  const toggleFavorite = useCallback(async () => {
    if (!platform || !selectedGameForFav) return;
    const current = stats[selectedGameForFav.name]?.favorite ?? false;
    await setFavorite(platform.name, selectedGameForFav.name, !current);
    await loadStats();
  }, [platform, selectedGameForFav, stats, loadStats]);

  useEffect(() => {
    if (searchVisible) {
      searchInputRef.current?.focus();
    }
  }, [searchVisible]);

  const launchGame = useCallback(
    async (game: HyperspinGame) => {
      if (!platform || launchingGameName) return;
      // Jogo sem ROM no disco (modo "mostrar sem ROMs"): não dá pra abrir.
      if (!game.hasRom) return;

      setLaunchingGameName(game.name);

      const clearLoadingOnBlurOrTimeout = new Promise<void>((resolve) => {
        let done = false;

        const finish = () => {
          if (done) return;
          done = true;
          window.removeEventListener("blur", handleBlur);
          clearTimeout(timer);
          resolve();
        };

        const handleBlur = () => {
          finish();
        };

        const timer = window.setTimeout(finish, 4000);
        window.addEventListener("blur", handleBlur, { once: true });
      });

      try {
        void recordGameLaunch({
          platformName: platform.name,
          romName: game.name,
        });

        const launchPromise = launchSelectedGame({
          platformName: platform.name,
          romName: game.name,
          romPath: game.romPath,
        });

        // O indicador fica até o jogo realmente iniciar (janela perde foco)
        // ou, no pior caso, até um timeout curto.
        await clearLoadingOnBlurOrTimeout;

        await launchPromise;
      } catch (error) {
        console.error("Erro ao executar jogo:", error);
      } finally {
        setLaunchingGameName(null);
        void loadStats();
      }
    },
    [launchingGameName, platform, loadStats],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase() ?? "";
      const isTypingField =
        tagName === "input" ||
        tagName === "textarea" ||
        target?.isContentEditable === true;

      if (event.key === "/") {
        if (isTypingField) return;

        event.preventDefault();
        setSearchVisible(true);
        return;
      }

      if (event.key.toLowerCase() === "f" && !event.ctrlKey && !event.metaKey) {
        if (isTypingField) return;
        if (Date.now() < keyboardUnlockAt) return;
        event.preventDefault();
        void toggleFavorite();
        return;
      }

      if (event.key === "Escape") {
        if (Date.now() < keyboardUnlockAt) {
          event.preventDefault();
          return;
        }

        if (searchVisible || searchTerm) {
          event.preventDefault();
          setSearchVisible(false);
          setSearchTerm("");
          return;
        }

        event.preventDefault();
        navigate(-1);
        return;
      }

      if (event.key === "Enter" && selectedGame && !isTypingField) {
        if (Date.now() < keyboardUnlockAt || event.repeat) {
          event.preventDefault();
          return;
        }

        event.preventDefault();
        void launchGame(selectedGame);
        return;
      }

      if (filteredGames.length === 0) return;

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((currentIndex) =>
          currentIndex <= 0 ? filteredGames.length - 1 : currentIndex - 1,
        );
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((currentIndex) =>
          currentIndex >= filteredGames.length - 1 ? 0 : currentIndex + 1,
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    filteredGames.length,
    navigate,
    platform?.name,
    searchTerm,
    searchVisible,
    selectedGame,
    launchGame,
    keyboardUnlockAt,
    toggleFavorite,
  ]);

  if (!canPlay) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <div className="text-lg font-semibold">Sessão expirada ou não iniciada</div>
          <button
            type="button"
            onClick={() => navigate("/", { replace: true })}
            className="mt-4 rounded bg-zinc-800 px-4 py-2 text-sm text-white"
          >
            Voltar para pagamento
          </button>
        </div>
      </div>
    );
  }

  if (!platform) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <div className="text-lg font-semibold">
            Nenhuma plataforma selecionada
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-4 rounded bg-zinc-800 px-4 py-2 text-sm text-white"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white">
      <GameBackground game={selectedGame} />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/85 via-black/30 to-black/70" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40" />

      <div className="absolute left-8 top-7 z-30 flex items-center gap-3">
        <div className="rounded-xl border border-white/10 bg-black/50 px-4 py-2 text-sm font-bold uppercase tracking-widest text-white backdrop-blur-md">
          {platform.name}
        </div>
        <div className="rounded-lg bg-black/40 px-3 py-2 text-[11px] text-zinc-300 backdrop-blur-sm">
          Enter inicia • / busca • F favorita • Esc volta • Ctrl+M sai
        </div>
      </div>

      {/* barra de filtros e ordenação */}
      <div className="absolute left-8 top-20 z-30 flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "Todos"],
            ["favorites", "★ Favoritos"],
            ["mostplayed", "Mais jogados"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setFilterMode(mode)}
            className={[
              "rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-sm transition",
              filterMode === mode
                ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                : "border-white/10 bg-black/40 text-zinc-300 hover:border-zinc-400",
            ].join(" ")}
          >
            {label}
          </button>
        ))}

        <select
          value={genreFilter}
          onChange={(e) => setGenreFilter(e.target.value)}
          className="rounded-full border border-white/10 bg-black/50 px-3 py-1 text-xs text-zinc-200 backdrop-blur-sm outline-none"
        >
          <option value="all">Todos os gêneros</option>
          {genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="rounded-full border border-white/10 bg-black/50 px-3 py-1 text-xs text-zinc-200 backdrop-blur-sm outline-none"
        >
          <option value="az">A–Z</option>
          <option value="plays">Mais jogados</option>
          <option value="year">Lançamentos (ano)</option>
        </select>
      </div>

      {searchVisible ? (
        <div className="absolute left-1/2 top-6 z-40 -translate-x-1/2">
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Filtrar jogo..."
            className="w-full rounded-xl border border-zinc-700 bg-black/75 px-4 py-3 text-sm text-white outline-none backdrop-blur-md placeholder:text-zinc-500 focus:border-zinc-500"
          />
        </div>
      ) : null}

      {launchingGameName ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 text-base font-semibold text-zinc-100">
          Carregando {launchingGameName}...
        </div>
      ) : null}

      {loadingGames ? (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-zinc-950">
          <Spinner className="size-12 text-emerald-400" />
          <span className="text-sm font-medium text-zinc-400">
            Carregando jogos...
          </span>
        </div>
      ) : gamesError ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center px-6 text-center text-sm text-red-500">
          {gamesError}
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center px-6 text-center text-sm text-zinc-400">
          {searchTerm.trim()
            ? "Nenhum jogo encontrado para esse filtro."
            : "Nenhum jogo encontrado."}
        </div>
      ) : (
        <>
          <HyperspinWheel
            items={wheelItems}
            selectedIndex={safeSelectedIndex}
            disabled={Boolean(launchingGameName)}
            onSelect={(index) => {
              if (index === safeSelectedIndex) {
                const game = filteredGames[index];
                if (game) void launchGame(game);
              } else {
                setSelectedIndex(index);
              }
            }}
          />

          {selectedGame ? (
            <div className="pointer-events-none absolute bottom-10 left-8 z-30 max-w-[46%]">
              <div className="flex items-center gap-3">
                {!selectedGame.hasRom ? (
                  <span className="rounded-full bg-red-500/20 px-3 py-0.5 text-xs font-bold text-red-300">
                    SEM ROM
                  </span>
                ) : null}
                {stats[selectedGame.name]?.favorite ? (
                  <span className="text-3xl text-amber-300 drop-shadow">★</span>
                ) : null}
                {(stats[selectedGame.name]?.playCount ?? 0) > 0 ? (
                  <span className="rounded-full bg-black/45 px-2 py-0.5 text-xs text-zinc-300 backdrop-blur-sm">
                    {stats[selectedGame.name]?.playCount}x jogado
                  </span>
                ) : null}
              </div>
              <div className="truncate text-5xl font-black uppercase tracking-wide text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.8)]">
                {selectedGame.description}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {[selectedGame.year, selectedGame.manufacturer, selectedGame.genre]
                  .filter(Boolean)
                  .map((info) => (
                    <span
                      key={info as string}
                      className="rounded-full border border-white/10 bg-black/45 px-3 py-1 text-xs font-semibold text-zinc-200 backdrop-blur-sm"
                    >
                      {info}
                    </span>
                  ))}
              </div>
              <div className="mt-4 text-sm text-zinc-400">
                {safeSelectedIndex + 1} / {filteredGames.length} jogos
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
