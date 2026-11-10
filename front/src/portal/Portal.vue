<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { request, signOut } from '../api.js';
import Icon from './Icon.vue';
import TournamentArt from './TournamentArt.vue';
import { gameTheme } from './gameTheme.js';

const data = ref(null);
const busy = ref(true);
const error = ref('');
const hash = ref(location.hash);
const content = ref(null);
const teamFilter = ref('');
const motionPaused = ref(false);
const signingOut = ref(false);
const pageNames = { inicio: 'Portal del jugador', torneos: 'Torneos', equipos: 'Equipos', resultados: 'Resultados' };
const route = computed(() => {
  const [section, first, second] = hash.value.slice(1).split('/');
  return { section: Object.hasOwn(pageNames, section) ? section : 'inicio', first, second };
});
const isTeams = computed(() => route.value.section === 'equipos');
const isDirectory = computed(() => isTeams.value || route.value.section === 'torneos');

const dates = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const numbers = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });
const states = {
  INSCRIPCION: 'Inscripción abierta',
  EN_CURSO: 'En curso',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
};
const dateLabel = value => dates.format(new Date(value));
const initials = name => name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
const duration = value => {
  const ms = Number(value);
  const minutes = Math.floor(ms / 60000);
  const seconds = String(Math.floor(ms / 1000) % 60).padStart(2, '0');
  return `${minutes}:${seconds}.${String(ms % 1000).padStart(3, '0')}`;
};

async function load() {
  busy.value = true;
  error.value = '';
  try {
    data.value = await request('/api/portal');
  } catch (problem) {
    error.value = problem.message;
  } finally {
    busy.value = false;
  }
}

async function logout() {
  signingOut.value = true;
  try { await signOut(); }
  catch (problem) { error.value = problem.message; signingOut.value = false; }
}
function updateRoute() {
  hash.value = location.hash;
  window.scrollTo(0, 0);
  content.value?.focus({ preventScroll: true });
}

onMounted(() => {
  window.addEventListener('hashchange', updateRoute);
  load();
});
onUnmounted(() => window.removeEventListener('hashchange', updateRoute));

const gameById = computed(() => new Map(data.value?.videojuegos.map(item => [item.VideojuegoId, item])));
const tournamentById = computed(() => new Map(data.value?.torneos.map(item => [item.TorneoId, item])));
const selectedGame = computed(() => gameById.value.get(Number(route.value.first)));
const selectedTheme = computed(() => selectedGame.value ? gameTheme(selectedGame.value.Nombre) : null);
const selectedCategory = computed(() => data.value?.categorias.find(item => item.CategoriaId === selectedGame.value?.CategoriaId));
const directoryRoot = computed(() => `#${route.value.section}`);
const gameLink = id => `${directoryRoot.value}/${id}`;

function groupRows(rows, key) {
  const grouped = new Map();
  for (const row of rows) {
    const id = key(row);
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(row);
  }
  return grouped;
}

const tournamentsByGame = computed(() => groupRows(data.value?.torneos ?? [], item => item.VideojuegoId));
const teamsByGame = computed(() => groupRows(data.value?.equipos ?? [], item => item.VideojuegoId));
const playersByTeam = computed(() => groupRows(data.value?.jugadores ?? [], item => item.EquipoId));
const matchTeamKey = row => `${row.PartidaId}:${row.EquipoId}`;
const kdaByTeam = computed(() => groupRows(data.value?.kda ?? [], matchTeamKey));
const racesByTeam = computed(() => groupRows(data.value?.carreras ?? [], matchTeamKey));
const catalog = computed(() => (data.value?.categorias ?? []).map(category => ({
  ...category,
  games: data.value.videojuegos.filter(game => game.CategoriaId === category.CategoriaId),
})).filter(category => category.games.length));
const directoryItems = gameId => (isTeams.value ? teamsByGame.value : tournamentsByGame.value).get(gameId) ?? [];
function directoryCount(gameId) {
  const count = directoryItems(gameId).length;
  const label = isTeams.value ? 'equipo' : 'torneo';
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}
const itemId = item => isTeams.value ? item.EquipoId : item.TorneoId;
const selectedItems = computed(() => directoryItems(selectedGame.value?.VideojuegoId));
const selectedItem = computed(() => selectedItems.value.find(item => itemId(item) === Number(route.value.second)));
const roster = computed(() => playersByTeam.value.get(selectedItem.value?.EquipoId) ?? []);
const resultsTournament = computed(() => route.value.first === 'torneo'
  ? tournamentById.value.get(Number(route.value.second))
  : undefined);

watch(route, ({ section, first, second }) => {
  teamFilter.value = section === 'resultados' && first === 'equipo' && second ? Number(second) : '';
}, { immediate: true });

const results = computed(() => {
  const rows = (data.value?.partidas ?? []).filter(row => tournamentById.value.has(row.TorneoId)
    && (!resultsTournament.value || row.TorneoId === resultsTournament.value.TorneoId));
  return Array.from(groupRows(rows, row => row.PartidaId).values())
    .filter(match => !teamFilter.value || match.some(row => row.EquipoId === teamFilter.value))
    .map(match => {
      const first = match[0];
      const tournament = tournamentById.value.get(first.TorneoId);
      return {
        ...first,
        tournament,
        game: gameById.value.get(tournament.VideojuegoId),
        teams: match.map(row => {
          const kda = kdaByTeam.value.get(matchTeamKey(row)) ?? [];
          const races = racesByTeam.value.get(matchTeamKey(row)) ?? [];
          const totals = kda.reduce((sum, player) => ({
            kills: sum.kills + player.Asesinatos,
            deaths: sum.deaths + player.Muertes,
            assists: sum.assists + player.Asistencias,
          }), { kills: 0, deaths: 0, assists: 0 });
          return { id: row.EquipoId, name: row.Equipo, kda, races, totals };
        }),
      };
    });
});

const summary = computed(() => {
  if (!data.value) return null;
  const { categorias, videojuegos, torneos, equipos, partidas } = data.value;
  const finished = torneos.filter(tournament => tournament.Estado === 'FINALIZADO').length;
  const series = categorias.map(item => {
    const ids = new Set(videojuegos.filter(v => v.CategoriaId === item.CategoriaId).map(v => v.VideojuegoId));
    return {
      name: item.Nombre,
      tournaments: torneos.filter(t => ids.has(t.VideojuegoId)).length,
      teams: equipos.filter(t => ids.has(t.VideojuegoId)).length,
    };
  });
  return {
    tournaments: torneos.length,
    teams: equipos.length,
    matches: new Set(partidas.map(row => row.PartidaId)).size,
    finished,
    percent: torneos.length ? Math.round(finished / torneos.length * 100) : 0,
    series,
    maximum: Math.max(1, ...series.flatMap(item => [item.tournaments, item.teams])),
  };
});

</script>

<template>
  <a class="skip-link" href="#contenido" @click.prevent="content?.focus()">Ir al contenido</a>
  <header class="topbar">
    <div class="topbar-inner">
      <a href="#inicio" class="brand">
        <span class="brand-mark"><Icon name="game" /></span>
        <span>arena<span class="brand-period">.</span><small>PORTAL DE COMPETENCIA</small></span>
      </a>
      <nav aria-label="Secciones del portal">
        <a href="#inicio" :aria-current="route.section === 'inicio' ? 'page' : undefined"><Icon name="grid" /> Resumen</a>
        <a href="#torneos" :aria-current="route.section === 'torneos' ? 'page' : undefined"><Icon name="trophy" /> Torneos</a>
        <a href="#equipos" :aria-current="route.section === 'equipos' ? 'page' : undefined"><Icon name="users" /> Equipos</a>
        <a href="#resultados" :aria-current="route.section === 'resultados' ? 'page' : undefined"><Icon name="chart" /> Resultados</a>
      </nav>
      <button class="admin-link" type="button" :disabled="signingOut" @click="logout">Cerrar sesión <Icon name="external" /></button>
    </div>
  </header>

  <main id="contenido" ref="content" class="layout" tabindex="-1">
    <section id="inicio" class="intro">
      <div>
        <p class="eyebrow"><span class="eyebrow-dot"></span> ARENA / COMUNIDAD</p>
        <h1>{{ pageNames[route.section] }}</h1>
      </div>
      <button type="button" class="refresh" :disabled="busy" @click="load">
        <Icon name="refresh" /> <span>{{ busy ? 'Actualizando…' : 'Actualizar datos' }}</span>
      </button>
    </section>

    <div v-if="busy && !data" class="panel notice" role="status">Cargando torneos, equipos y resultados…</div>
    <div v-if="error" class="panel notice error" role="alert">
      <strong>No pudimos actualizar el portal.</strong>
      <p>{{ error }}</p>
      <button type="button" class="button" @click="load">Volver a intentar</button>
    </div>

    <template v-if="data && route.section === 'inicio'">
      <div class="overview">
        <section class="hero">
          <div class="hero-copy">
            <p class="eyebrow">TU PRÓXIMO TORNEO</p>
            <h2>La competencia<br />empieza aquí.</h2>
            <p>Explora el calendario, conoce a los equipos y sigue las partidas jugadas.</p>
            <a href="#torneos" class="hero-link">Explorar torneos <Icon name="arrow" /></a>
          </div>
          <div class="hero-art" aria-hidden="true">
            <div class="orbit orbit-outer"></div><div class="orbit orbit-inner"></div>
            <span class="spark spark-one">✦</span><span class="spark spark-two">✧</span><span class="spark spark-three">✦</span>
            <span class="trophy-orb"><Icon name="trophy" /></span>
          </div>
        </section>
        <a href="#torneos" class="panel metric directory-entry">
          <span class="tile-icon violet"><Icon name="trophy" /></span>
          <p class="metric-number">{{ summary.tournaments }}</p>
          <h2>Torneos creados</h2>
          <svg class="metric-chart" viewBox="0 0 180 58" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 54H180" class="chart-rule" />
            <rect v-for="(item, i) in summary.series" :key="item.name" :x="180 * (i + .2) / summary.series.length"
                  :y="54 - 47 * item.tournaments / summary.maximum" :width="180 / summary.series.length * .56"
                  :height="47 * item.tournaments / summary.maximum" rx="4" class="bar-violet" />
          </svg>
          <p class="metric-caption">Distribución por categoría</p>
        </a>
        <a href="#equipos" class="panel metric directory-entry">
          <span class="tile-icon amber"><Icon name="users" /></span>
          <p class="metric-number">{{ summary.teams }}</p>
          <h2>Equipos registrados</h2>
          <svg class="metric-chart" viewBox="0 0 180 58" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 54H180" class="chart-rule" />
            <rect v-for="(item, i) in summary.series" :key="item.name" :x="180 * (i + .2) / summary.series.length"
                  :y="54 - 47 * item.teams / summary.maximum" :width="180 / summary.series.length * .56"
                  :height="47 * item.teams / summary.maximum" rx="4" class="bar-amber" />
          </svg>
          <p class="metric-caption">Distribución por categoría</p>
        </a>
      </div>

      <div class="insights">
        <section class="panel insight">
          <div class="panel-title"><h2>Actividad por categoría</h2><Icon name="chart" /></div>
          <div class="legend"><span><i class="dot violet"></i>Torneos</span><span><i class="dot amber"></i>Equipos</span></div>
          <ul class="category-chart">
            <li v-for="item in summary.series" :key="item.name">
              <span>{{ item.name }}</span>
              <div class="bar-pair">
                <div><svg viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="6" rx="3" class="bar-track" /><rect :width="100 * item.tournaments / summary.maximum" height="6" rx="3" class="bar-violet" /></svg><strong>{{ item.tournaments }}<span class="sr-only"> torneos</span></strong></div>
                <div><svg viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="6" rx="3" class="bar-track" /><rect :width="100 * item.teams / summary.maximum" height="6" rx="3" class="bar-amber" /></svg><strong>{{ item.teams }}<span class="sr-only"> equipos</span></strong></div>
              </div>
            </li>
          </ul>
        </section>
        <section class="panel insight">
          <div class="panel-title"><h2>Estado de la competencia</h2><Icon name="flag" /></div>
          <div class="completion">
            <div class="completion-copy">
              <strong>{{ summary.matches }}</strong>
              <span>Partidas finalizadas</span>
              <p>{{ summary.finished }} de {{ summary.tournaments }} torneos finalizados</p>
            </div>
            <div class="ring" :aria-label="`${summary.percent}% de torneos finalizados`" role="img">
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <defs><linearGradient id="ring-color" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#a095ff" /><stop offset="1" stop-color="#f38b8c" /></linearGradient></defs>
                <circle cx="60" cy="60" r="49" class="ring-track" />
                <circle v-if="summary.percent" cx="60" cy="60" r="49" pathLength="100" class="ring-progress"
                        :stroke-dasharray="`${summary.percent} 100`" transform="rotate(-90 60 60)" />
              </svg>
              <span aria-hidden="true">{{ summary.percent }}<small>%</small></span>
            </div>
          </div>
        </section>
      </div>

    </template>

    <section v-if="data && isDirectory" :key="hash" class="directory"
             :class="{ 'tournament-directory': !isTeams, 'motion-paused': motionPaused }"
             :data-game="selectedTheme?.key">
      <div v-if="selectedGame || (!isTeams && catalog.length)" class="directory-topline">
        <a v-if="selectedGame" :href="selectedItem ? gameLink(selectedGame.VideojuegoId) : directoryRoot" class="text-link">
          <Icon name="arrow" class="back-arrow" />
          {{ selectedItem ? (isTeams ? 'Volver a equipos' : 'Volver a torneos') : 'Volver a juegos' }}
        </a>
        <button v-if="!isTeams" type="button" class="motion-control" @click="motionPaused = !motionPaused">
          {{ motionPaused ? 'Reanudar animaciones' : 'Pausar animaciones' }}
        </button>
      </div>

      <div v-if="!isTeams && selectedGame" class="panel tournament-banner">
        <TournamentArt :game="selectedGame.Nombre" />
        <div class="tournament-banner-copy">
          <p class="eyebrow">{{ selectedCategory?.Nombre ?? 'COMPETENCIA' }}</p>
          <h2>{{ selectedGame.Nombre }}</h2>
          <p>{{ directoryCount(selectedGame.VideojuegoId) }}</p>
        </div>
      </div>

      <template v-if="!selectedGame">
        <div class="directory-heading">
          <p class="eyebrow">PASO 1 DE 2</p>
          <h2>Elige un videojuego</h2>
          <p class="section-description">{{ isTeams ? 'Encuentra los equipos de cada juego.' : 'Consulta los torneos de cada juego.' }}</p>
        </div>
        <p v-if="!catalog.length" class="panel notice">Todavía no hay videojuegos registrados.</p>
        <div v-if="isTeams" class="game-grid">
          <template v-for="category in catalog" :key="category.CategoriaId">
            <a v-for="game in category.games" :key="game.VideojuegoId" :href="gameLink(game.VideojuegoId)"
               class="panel directory-card game-shortcut" :data-game="gameTheme(game.Nombre).key">
              <TournamentArt :game="game.Nombre" />
              <span class="tile-icon game-emblem"><Icon :name="gameTheme(game.Nombre).icon" /></span>
              <span class="directory-card-copy">
                <small class="game-category">{{ category.Nombre }}</small>
                <strong>{{ game.Nombre }}</strong>
                <small>{{ directoryCount(game.VideojuegoId) }}</small>
              </span>
              <Icon name="arrow" class="directory-arrow" />
            </a>
          </template>
        </div>
        <div v-else class="game-grid tournament-grid">
          <template v-for="category in catalog" :key="category.CategoriaId">
            <a v-for="game in category.games" :key="game.VideojuegoId" :href="gameLink(game.VideojuegoId)"
               class="panel tournament-game" :data-game="gameTheme(game.Nombre).key">
              <TournamentArt :game="game.Nombre" />
              <span class="tournament-game-category"><Icon :name="gameTheme(game.Nombre).icon" />{{ category.Nombre }}</span>
              <span class="tournament-game-copy">
                <span><strong>{{ game.Nombre }}</strong><small>{{ directoryCount(game.VideojuegoId) }}</small></span>
                <span class="tournament-game-arrow"><Icon name="arrow" /></span>
              </span>
            </a>
          </template>
        </div>
      </template>

      <template v-else-if="!selectedItem">
        <div class="directory-heading">
          <p class="eyebrow">PASO 2 DE 2<template v-if="isTeams"> · {{ selectedGame.Nombre }}</template></p>
          <h2>{{ isTeams ? '¿Qué equipo quieres ver?' : '¿Qué torneo quieres ver?' }}</h2>
        </div>
        <p v-if="!selectedItems.length" class="panel notice">{{ isTeams ? 'Aún no hay equipos para este juego.' : 'Aún no hay torneos para este juego.' }}</p>
        <div v-else class="game-grid">
          <a v-for="item in selectedItems" :key="itemId(item)" :href="`${gameLink(selectedGame.VideojuegoId)}/${itemId(item)}`" class="panel directory-card game-item">
            <span class="tile-icon game-emblem"><Icon :name="selectedTheme.key ? selectedTheme.icon : (isTeams ? 'users' : 'trophy')" /></span>
            <span class="directory-card-copy">
              <strong>{{ item.Nombre }}</strong>
              <small v-if="!isTeams">Inicio <time :datetime="item.FechaInicio.slice(0, 10)">{{ dateLabel(item.FechaInicio) }}</time></small>
            </span>
            <Icon name="arrow" class="directory-arrow" />
          </a>
        </div>
      </template>

      <article v-else class="panel directory-detail">
        <div class="team-heading">
          <span class="tile-icon game-emblem"><Icon :name="selectedTheme.key ? selectedTheme.icon : (isTeams ? 'users' : 'trophy')" /></span>
          <div><h2>{{ selectedItem.Nombre }}</h2><span>{{ selectedGame.Nombre }}<template v-if="selectedCategory"> · {{ selectedCategory.Nombre }}</template></span></div>
          <span v-if="!isTeams" class="status" :data-state="selectedItem.Estado">{{ states[selectedItem.Estado] ?? selectedItem.Estado }}</span>
          <span v-else-if="!selectedItem.Activo" class="status">Retirado</span>
        </div>
        <template v-if="isTeams">
          <h3 class="detail-heading">Integrantes</h3>
          <ul v-if="roster.length" class="roster">
            <li v-for="player in roster" :key="player.JugadorId">
              <span class="avatar player-avatar" aria-hidden="true">{{ initials(player.Alias) }}</span>
              <strong>{{ player.Alias }}</strong><small>Cupo {{ player.Cupo }}</small>
            </li>
          </ul>
          <p v-else class="empty-inline">Todavía no tiene integrantes.</p>
        </template>
        <dl v-else class="tournament-facts">
          <div><dt>Fecha de inicio</dt><dd><time :datetime="selectedItem.FechaInicio.slice(0, 10)">{{ dateLabel(selectedItem.FechaInicio) }}</time></dd></div>
          <div><dt>Fecha de término</dt><dd><time :datetime="selectedItem.FechaFin.slice(0, 10)">{{ dateLabel(selectedItem.FechaFin) }}</time></dd></div>
          <div><dt>Equipos inscritos</dt><dd>{{ selectedItem.EquiposInscritos }}</dd></div>
        </dl>
        <a :href="`#resultados/${isTeams ? 'equipo' : 'torneo'}/${itemId(selectedItem)}`" class="text-link">Ver resultados <Icon name="arrow" /></a>
      </article>

      </section>

      <section v-if="data && route.section === 'resultados'">
        <div class="section-heading">
          <div><p class="eyebrow">03 / MARCADORES</p><h2>Resultados de partidas</h2></div>
          <label class="select-field">Equipo
            <select v-model="teamFilter">
              <option value="">Todos los equipos</option>
              <option v-for="team in data.equipos" :key="team.EquipoId" :value="team.EquipoId">{{ team.Nombre }}</option>
            </select>
          </label>
        </div>
        <p v-if="resultsTournament" class="section-description">
          Torneo: <strong>{{ resultsTournament.Nombre }}</strong> · <a href="#resultados" class="text-link">Ver todos los torneos</a>
        </p>
        <p class="section-description">Consulta las partidas finalizadas y las estadísticas de cada equipo participante.</p>
        <p v-if="!results.length" class="panel notice">No hay partidas finalizadas para esta selección.</p>
        <div v-else class="match-list">
          <article v-for="match in results" :key="match.PartidaId" class="panel match">
            <div class="match-heading">
              <div><span class="match-game">{{ match.game.Nombre }} · {{ match.tournament.Nombre }}</span><h3>{{ match.Nombre }}</h3></div>
              <span class="date-label"><Icon name="calendar" /><time :datetime="match.FechaHora">{{ dateLabel(match.FechaHora) }}</time></span>
            </div>
            <div class="match-teams">
              <details v-for="result in match.teams" :key="result.id" class="match-team"
                       :class="{ highlighted: result.id === teamFilter }">
                <summary>
                  <span class="avatar team-avatar" aria-hidden="true">{{ initials(result.name) }}</span>
                  <span class="result-name">
                    <strong>{{ result.name }}</strong>
                    <small v-if="result.kda.length">{{ result.totals.kills }} bajas · {{ result.totals.deaths }} muertes · {{ result.totals.assists }} asistencias</small>
                    <small v-else-if="result.races.length">Mejor posición: {{ result.races[0].Posicion }}° · {{ duration(result.races[0].TiempoMilisegundos) }}</small>
                    <small v-else>Sin estadísticas registradas</small>
                  </span>
                  <Icon name="chevron" class="chevron" />
                </summary>
                <div v-if="result.kda.length" class="table-wrap">
                  <table>
                    <thead><tr><th>Jugador</th><th>Bajas</th><th>Muertes</th><th>Asist.</th><th>KDA</th></tr></thead>
                    <tbody><tr v-for="player in result.kda" :key="player.JugadorId"><th scope="row">{{ player.Alias }}</th><td>{{ player.Asesinatos }}</td><td>{{ player.Muertes }}</td><td>{{ player.Asistencias }}</td><td>{{ numbers.format(player.KDA) }}</td></tr></tbody>
                  </table>
                </div>
                <div v-else-if="result.races.length" class="table-wrap">
                  <table>
                    <thead><tr><th>Jugador</th><th>Pos.</th><th>Tiempo</th><th>Vueltas</th></tr></thead>
                    <tbody><tr v-for="player in result.races" :key="player.JugadorId"><th scope="row">{{ player.Alias }}</th><td>{{ player.Posicion }}°</td><td>{{ duration(player.TiempoMilisegundos) }}</td><td>{{ player.Vueltas }}</td></tr></tbody>
                  </table>
                </div>
                <p v-else class="empty-inline result-empty">El equipo participó en la partida. Sus estadísticas aún no se han ingresado.</p>
              </details>
            </div>
          </article>
        </div>
      </section>
    <footer><span><strong>arena.</strong> Portal del jugador</span><a href="#inicio">Ir al resumen</a></footer>
  </main>
</template>
