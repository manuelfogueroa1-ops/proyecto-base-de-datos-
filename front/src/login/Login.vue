<script setup>
import { computed, onMounted, ref } from 'vue';
import { request } from '../api.js';
import Icon from '../portal/Icon.vue';
import { gameTheme } from '../portal/gameTheme.js';

const games = ['League of Legends', 'Valorant', 'Counter-Strike', 'Assetto Corsa'];
const screens = {
  entrar: {title: 'Inicia sesión', action: 'Entrar a Arena', description: 'Ingresa con tu cuenta de jugador o administrador.'},
  registro: {title: 'Crea tu cuenta', action: 'Crear cuenta como usuario de la plataforma', description: 'Accede a los torneos, equipos y resultados desde el portal del jugador.'},
  configurar: {title: 'Configura el administrador', action: 'Crear administrador', description: 'Ingresa el código de configuración que aparece al iniciar Arena y elige tus datos de acceso.'},
};
const mode = ref('entrar');
const screen = computed(() => screens[mode.value]);
const creating = computed(() => mode.value !== 'entrar');
const canConfigure = ref(false);
const username = ref('');
const password = ref('');
const code = ref('');
const error = ref('');
const busy = ref(false);
const showPassword = ref(false);

onMounted(async () => {
  try {
    const config = await request('/api/acceso/configuracion');
    if (config.destino) location.replace(config.destino);
    canConfigure.value = config.configurar;
  } catch (problem) {
    error.value = problem.message;
  }
});

function selectScreen(next) {
  mode.value = next;
  password.value = '';
  code.value = '';
  error.value = '';
  showPassword.value = false;
}

async function submit() {
  busy.value = true;
  error.value = '';
  try {
    const body = {usuario: username.value, clave: password.value};
    if (mode.value === 'configurar') body.codigo = code.value;
    const session = await request(`/api/acceso/${mode.value}`, 'POST', body);
    location.replace(session.destino);
  } catch (problem) {
    error.value = problem.message;
    busy.value = false;
  }
}
</script>

<template>
  <main class="access">
    <section class="showcase" aria-labelledby="showcase-title">
      <div class="brand"><span class="brand-emblem"><Icon name="game" /></span><span>arena<span class="brand-dot">.</span></span></div>
      <div class="showcase-copy">
        <p class="overline">EL PUNTO DE ENCUENTRO</p>
        <h1 id="showcase-title">Nos vemos<br />en la arena.</h1>
        <p>Cuatro juegos, una comunidad. Sigue tus torneos y a los equipos que compiten.</p>
      </div>
      <div class="game-wall">
        <figure v-for="game in games" :key="game" class="game-photo" :data-game="gameTheme(game).key">
          <img :src="`/torneos/${gameTheme(game).key}.webp`" alt="" width="1280" height="720" decoding="async" />
          <figcaption><Icon :name="gameTheme(game).icon" /> {{ game }}</figcaption>
        </figure>
      </div>
    </section>

    <section class="access-panel" aria-labelledby="form-title">
      <div class="form-card">
        <p class="overline">CUENTA ARENA</p>
        <h2 id="form-title">{{ screen.title }}</h2>
        <p class="form-description">{{ screen.description }}</p>
        <form @submit.prevent="submit">
          <label for="username">Usuario</label>
          <input id="username" v-model="username" autocomplete="username" autocapitalize="none"
                 spellcheck="false" minlength="3" maxlength="32" pattern="[A-Za-z0-9_.\-]{3,32}" required />
          <label for="password">Contraseña</label>
          <div class="password-field">
            <input id="password" v-model="password" :type="showPassword ? 'text' : 'password'"
                   :autocomplete="creating ? 'new-password' : 'current-password'" :minlength="creating ? 12 : 1"
                   maxlength="128" :aria-describedby="creating ? 'password-tip' : undefined" required />
            <button class="reveal" type="button" @click="showPassword = !showPassword">{{ showPassword ? 'Ocultar' : 'Mostrar' }}</button>
          </div>
          <small v-if="creating" id="password-tip">Usa al menos 12 caracteres.</small>
          <template v-if="mode === 'configurar'">
            <label for="setup-code">Código de configuración</label>
            <input id="setup-code" v-model="code" type="password" autocomplete="off" minlength="20" maxlength="20" required />
          </template>
          <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          <button class="primary" type="submit" :disabled="busy">{{ busy ? 'Un momento…' : screen.action }} <Icon name="arrow" /></button>
        </form>
        <div class="form-links">
          <button v-if="creating" type="button" :disabled="busy" @click="selectScreen('entrar')">Volver a iniciar sesión</button>
          <template v-else>
            <button type="button" :disabled="busy" @click="selectScreen('registro')">{{ screens.registro.action }}</button>
            <button v-if="canConfigure" type="button" :disabled="busy" @click="selectScreen('configurar')">Configurar administrador</button>
          </template>
        </div>
      </div>
    </section>
  </main>
</template>
