<template>
  <div class="grabadora">
    <!-- Título -->
    <div class="header">
      <h1>🗣️ Cápsula de Preservación Lingüística</h1>
      <p>Preserva tu idioma para las generaciones futuras</p>
    </div>

    <!-- Datos del hablante -->
    <div class="card">
      <h3>📋 Datos del hablante nativo</h3>
      <div class="form-grid">
        <div class="campo">
          <label>Nombre completo *</label>
          <input 
            v-model="hablante.nombre" 
            type="text" 
            placeholder="Ej: María González"
            @keyup.enter="iniciarGrabacion"
          />
        </div>
        <div class="campo">
          <label>Edad</label>
          <input v-model="hablante.edad" type="number" placeholder="Ej: 72" />
        </div>
        <div class="campo">
          <label>Comunidad</label>
          <input v-model="hablante.comunidad" type="text" placeholder="Ej: Juchitán, Oaxaca" />
        </div>
        <div class="campo">
          <label>Idioma / Dialecto *</label>
          <input v-model="hablante.dialecto" type="text" placeholder="Ej: Zapoteco del Istmo" />
        </div>
      </div>
    </div>

    <!-- Tipo de grabación -->
    <div class="card">
      <h3>🎯 ¿Qué vas a grabar hoy?</h3>
      <div class="opciones-grid">
        <label 
          v-for="tipo in tiposGrabacion" 
          :key="tipo.valor"
          class="opcion"
          :class="{ activa: tipoGrabacion === tipo.valor }"
        >
          <input type="radio" v-model="tipoGrabacion" :value="tipo.valor" />
          <span class="emoji">{{ tipo.emoji }}</span>
          <span class="nombre">{{ tipo.nombre }}</span>
        </label>
      </div>
      
      <!-- Prompt según tipo -->
      <div class="prompt" v-if="promptActual">
        <strong>📖 Instrucción:</strong> {{ promptActual }}
      </div>
    </div>

    <!-- Controles de grabación -->
    <div class="card">
      <div class="controles">
        <button 
          @click="iniciarGrabacion" 
          :disabled="grabando || !formularioCompleto"
          class="btn btn-grabar"
        >
          🎙️ {{ grabando ? 'Grabando...' : 'Comenzar Grabación' }}
        </button>
        
        <button 
          @click="detenerGrabacion" 
          :disabled="!grabando"
          class="btn btn-detener"
        >
          ⏹️ Detener
        </button>
      </div>

      <!-- Temporizador -->
      <div class="temporizador" v-if="grabando">
        <span class="grabando-icono">🔴</span>
        Grabando: {{ Math.floor(tiempoGrabacion / 60) }}:{{ (tiempoGrabacion % 60).toString().padStart(2, '0') }}
      </div>

      <!-- Visualización de audio simple -->
      <canvas ref="canvasAudio" class="visualizador" v-if="grabando"></canvas>
    </div>

    <!-- Transcripción en tiempo real -->
    <div class="card" v-if="transcripcionActual">
      <h3>📝 Transcripción en tiempo real</h3>
      <div class="transcripcion-box">
        <p>{{ transcripcionActual }}</p>
      </div>
      
      <!-- Corrección por el hablante -->
      <div class="correccion">
        <label>✏️ ¿Algo incorrecto? Corrígelo aquí:</label>
        <textarea 
          v-model="correccionTexto" 
          rows="3"
          placeholder="Escribe la transcripción correcta..."
        ></textarea>
        <button @click="confirmarCorreccion" class="btn-corregir" :disabled="!correccionTexto">
          ✅ Confirmar corrección
        </button>
      </div>
    </div>

    <!-- Mensaje de estado -->
    <div class="mensaje" :class="{ error: mensajeError, exito: mensajeExito }" v-if="mensajeTexto">
      {{ mensajeTexto }}
    </div>

    <!-- Grabaciones recientes -->
    <div class="card" v-if="grabaciones.length > 0">
      <h3>📀 Grabaciones de esta sesión</h3>
      <div class="lista-grabaciones">
        <div v-for="(grab, index) in grabaciones" :key="grab.id" class="grabacion-item">
          <div class="info">
            <strong>{{ grab.hablante }}</strong> - {{ grab.tipo }}
            <span class="duracion">{{ grab.duracion }}s</span>
          </div>
          <div class="acciones">
            <button @click="reproducir(grab.audioUrl)" class="btn-escuchar">🔊 Escuchar</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onUnmounted } from 'vue'
import { guardarGrabacion } from '../services/api.js'

// ==================== DATOS DEL FORMULARIO ====================
const hablante = reactive({
  nombre: '',
  edad: '',
  comunidad: '',
  dialecto: ''
})

// Verificar si el formulario está completo
const formularioCompleto = computed(() => {
  return hablante.nombre.trim() !== '' && hablante.dialecto.trim() !== ''
})

// ==================== TIPOS DE GRABACIÓN ====================
const tiposGrabacion = [
  { valor: 'historia', nombre: 'Historia', emoji: '📖', prompt: 'Cuéntame una historia de tu comunidad o infancia' },
  { valor: 'palabras', nombre: 'Palabras', emoji: '📝', prompt: 'Di palabras básicas: números, familia, animales, comida' },
  { valor: 'cancion', nombre: 'Canción', emoji: '🎵', prompt: 'Canta una canción tradicional o un rezo' },
  { valor: 'frases', nombre: 'Frases', emoji: '💬', prompt: 'Di frases cotidianas: saludos, preguntas, despedidas' }
]

const tipoGrabacion = ref('historia')

const promptActual = computed(() => {
  const tipo = tiposGrabacion.find(t => t.valor === tipoGrabacion.value)
  return tipo ? tipo.prompt : ''
})

// ==================== ESTADO DE GRABACIÓN ====================
const grabando = ref(false)
const tiempoGrabacion = ref(0)
const transcripcionActual = ref('')
const correccionTexto = ref('')
const mensajeTexto = ref('')
const mensajeError = ref(false)
const mensajeExito = ref(false)
const grabaciones = ref([])

// Variables para la grabación
let mediaRecorder = null
let chunksAudio = []
let intervaloTiempo = null
let streamAudio = null
let reconocimientoVoz = null

// Canvas para visualización
const canvasAudio = ref(null)
let contextoAudio = null
let analizador = null
let fuenteAudio = null

// ==================== FUNCIONES PRINCIPALES ====================

const iniciarGrabacion = async () => {
  try {
    // Limpiar mensajes
    mensajeTexto.value = ''
    mensajeError.value = false
    
    // Solicitar micrófono
    mensajeTexto.value = '🎤 Solicitando permiso del micrófono...'
    
    streamAudio = await navigator.mediaDevices.getUserMedia({ audio: true })
    
    // Configurar MediaRecorder
    mediaRecorder = new MediaRecorder(streamAudio)
    chunksAudio = []
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksAudio.push(event.data)
      }
    }
    
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(chunksAudio, { type: 'audio/wav' })
      await guardarGrabacionLocal(audioBlob)
      
      if (streamAudio) {
        streamAudio.getTracks().forEach(track => track.stop())
      }
    }
    
    // Configurar analizador de audio para visualización
    if (canvasAudio.value) {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      analizador = audioContext.createAnalyser()
      fuenteAudio = audioContext.createMediaStreamSource(streamAudio)
      fuenteAudio.connect(analizador)
      dibujarVisualizador()
    }
    
    // Iniciar grabación
    mediaRecorder.start(500)
    grabando.value = true
    mensajeTexto.value = '🔴 Grabando... habla claramente'
    
    // Temporizador
    tiempoGrabacion.value = 0
    intervaloTiempo = setInterval(() => {
      tiempoGrabacion.value++
    }, 1000)
    
    // Iniciar reconocimiento de voz (Web Speech API)
    iniciarReconocimientoVoz()
    
  } catch (error) {
    console.error('Error:', error)
    mensajeTexto.value = '❌ Error: No se pudo acceder al micrófono. Verifica los permisos.'
    mensajeError.value = true
  }
}

const detenerGrabacion = () => {
  if (mediaRecorder && grabando.value) {
    mediaRecorder.stop()
    grabando.value = false
    
    if (intervaloTiempo) {
      clearInterval(intervaloTiempo)
    }
    
    if (reconocimientoVoz) {
      reconocimientoVoz.stop()
      reconocimientoVoz = null
    }
    
    mensajeTexto.value = '⏹️ Grabación detenida, guardando...'
  }
}

const guardarGrabacionLocal = async (audioBlob) => {
  try {
    // Mostrar mensaje de carga
    mensajeTexto.value = '💾 Guardando en la nube...'
    mensajeError.value = false
    
    // Enviar al backend
    const resultado = await guardarGrabacion(audioBlob, {
      nombre: hablante.nombre,
      edad: hablante.edad,
      comunidad: hablante.comunidad,
      dialecto: hablante.dialecto,
      tipoGrabacion: tipoGrabacion.value,
      duracion: tiempoGrabacion.value,
      transcripcion: transcripcionActual.value
    })
    
    // Crear URL local para reproducir (temporal)
    const audioUrl = URL.createObjectURL(audioBlob)
    
    // Guardar en historial local
    const nuevaGrabacion = {
      id: resultado.id,
      hablante: hablante.nombre,
      dialecto: hablante.dialecto,
      tipo: tipoGrabacion.value,
      duracion: tiempoGrabacion.value,
      fecha: new Date().toLocaleString(),
      transcripcion: transcripcionActual.value,
      audioUrl: audioUrl,
      audioBlob: audioBlob,
      guardadaEnNube: true
    }
    
    grabaciones.value.unshift(nuevaGrabacion)
    
    console.log('=== GRABACIÓN GUARDADA EN LA NUBE ===')
    console.log('ID:', resultado.id)
    console.log('URL:', resultado.audioUrl)
    console.log('=====================================')
    
    mensajeTexto.value = `✅ Grabación guardada en la nube: ${hablante.nombre} - ${tiempoGrabacion.value} segundos`
    mensajeExito.value = true
    
    // Limpiar después de 3 segundos
    setTimeout(() => {
      if (mensajeTexto.value.includes('guardada')) {
        mensajeTexto.value = ''
      }
    }, 3000)
    
  } catch (error) {
    console.error('Error al guardar:', error)
    mensajeTexto.value = '❌ Error al guardar en la nube. ¿El backend está corriendo?'
    mensajeError.value = true
  }
}

const iniciarReconocimientoVoz = () => {
  // Verificar si el navegador soporta Web Speech API
  if ('webkitSpeechRecognition' in window) {
    const SpeechRecognition = window.webkitSpeechRecognition
    reconocimientoVoz = new SpeechRecognition()
    reconocimientoVoz.continuous = true
    reconocimientoVoz.interimResults = true
    reconocimientoVoz.lang = 'es-ES'  // Cambiar según la lengua
    
    reconocimientoVoz.onresult = (event) => {
      let textoCompleto = ''
      for (let i = 0; i < event.results.length; i++) {
        textoCompleto += event.results[i][0].transcript
      }
      transcripcionActual.value = textoCompleto
    }
    
    reconocimientoVoz.onerror = (event) => {
      console.log('Error en reconocimiento de voz:', event.error)
      if (event.error === 'not-allowed') {
        transcripcionActual.value = '⚠️ Permiso denegado para el micrófono'
      }
    }
    
    reconocimientoVoz.start()
  } else {
    console.log('Web Speech API no soportada')
    transcripcionActual.value = 'ℹ️ La transcripción automática no está disponible en este navegador. Usa Chrome para mejor experiencia.'
  }
}

const confirmarCorreccion = () => {
  if (correccionTexto.value.trim()) {
    const anterior = transcripcionActual.value
    transcripcionActual.value = correccionTexto.value
    
    console.log('✅ Corrección guardada:')
    console.log('  Original:', anterior)
    console.log('  Corregido:', correccionTexto.value)
    
    // Actualizar la última grabación con la corrección
    if (grabaciones.value.length > 0) {
      grabaciones.value[0].transcripcion = correccionTexto.value
    }
    
    correccionTexto.value = ''
    mensajeTexto.value = '✅ ¡Gracias por la corrección! Ayuda a preservar mejor el idioma.'
    mensajeExito.value = true
    
    setTimeout(() => {
      if (mensajeTexto.value.includes('corrección')) {
        mensajeTexto.value = ''
      }
    }, 3000)
  }
}

const reproducir = (url) => {
  const audio = new Audio(url)
  audio.play()
}

// Visualizador de audio
const dibujarVisualizador = () => {
  if (!canvasAudio.value || !analizador) return
  
  const canvas = canvasAudio.value
  const ctx = canvas.getContext('2d')
  const ancho = canvas.width
  const alto = canvas.height
  
  analizador.fftSize = 256
  const bufferLength = analizador.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)
  
  const dibujar = () => {
    if (!grabando.value) return
    
    requestAnimationFrame(dibujar)
    analizador.getByteFrequencyData(dataArray)
    
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, ancho, alto)
    
    const barWidth = (ancho / bufferLength) * 2.5
    let x = 0
    
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * alto
      ctx.fillStyle = `rgb(100, ${200 - dataArray[i]}, 255)`
      ctx.fillRect(x, alto - barHeight, barWidth, barHeight)
      x += barWidth + 1
    }
  }
  
  dibujar()
}

// ==================== LIMPIEZA ====================
onUnmounted(() => {
  if (mediaRecorder && grabando.value) {
    mediaRecorder.stop()
  }
  if (intervaloTiempo) {
    clearInterval(intervaloTiempo)
  }
  if (reconocimientoVoz) {
    reconocimientoVoz.stop()
  }
  if (streamAudio) {
    streamAudio.getTracks().forEach(track => track.stop())
  }
})
</script>

<style scoped>
.grabadora {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.header {
  text-align: center;
  color: white;
  margin-bottom: 10px;
}

.header h1 {
  font-size: 2rem;
  margin-bottom: 10px;
}

.header p {
  opacity: 0.9;
}

.card {
  background: white;
  border-radius: 20px;
  padding: 25px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
}

.card h3 {
  margin-bottom: 20px;
  color: #333;
  font-size: 1.2rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.campo {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.campo label {
  font-weight: bold;
  color: #555;
  font-size: 0.9rem;
}

.campo input {
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 1rem;
  transition: all 0.3s;
}

.campo input:focus {
  outline: none;
  border-color: #667eea;
}

.opciones-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-bottom: 20px;
}

.opcion {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #f5f5f5;
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.3s;
}

.opcion.activa {
  background: #667eea;
  color: white;
}

.opcion input {
  display: none;
}

.emoji {
  font-size: 1.2rem;
}

.nombre {
  font-size: 0.9rem;
}

.prompt {
  background: #f0f4ff;
  padding: 15px;
  border-radius: 12px;
  color: #4a5568;
  border-left: 4px solid #667eea;
}

.controles {
  display: flex;
  gap: 15px;
  justify-content: center;
}

.btn {
  flex: 1;
  padding: 15px 30px;
  font-size: 1.1rem;
  font-weight: bold;
  border: none;
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-grabar {
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: white;
}

.btn-grabar:hover:not(:disabled) {
  transform: scale(1.02);
  box-shadow: 0 5px 20px rgba(76,175,80,0.4);
}

.btn-detener {
  background: linear-gradient(135deg, #f44336, #da190b);
  color: white;
}

.btn-detener:hover:not(:disabled) {
  transform: scale(1.02);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.temporizador {
  text-align: center;
  margin-top: 20px;
  font-size: 1.5rem;
  font-weight: bold;
  font-family: monospace;
}

.grabando-icono {
  animation: parpadeo 1s infinite;
}

@keyframes parpadeo {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.visualizador {
  width: 100%;
  height: 80px;
  margin-top: 20px;
  border-radius: 10px;
  background: #1a1a2e;
}

.transcripcion-box {
  background: #f5f5f5;
  padding: 15px;
  border-radius: 12px;
  margin: 15px 0;
  font-style: italic;
  color: #333;
  line-height: 1.5;
}

.correccion {
  margin-top: 15px;
}

.correccion label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #555;
}

.correccion textarea {
  width: 100%;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 1rem;
  resize: vertical;
  font-family: inherit;
}

.correccion textarea:focus {
  outline: none;
  border-color: #667eea;
}

.btn-corregir {
  margin-top: 10px;
  padding: 10px 20px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 50px;
  cursor: pointer;
  font-weight: bold;
}

.btn-corregir:hover:not(:disabled) {
  background: #5a67d8;
}

.mensaje {
  padding: 15px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
}

.mensaje.error {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ffcdd2;
}

.mensaje.exito {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #c8e6c9;
}

.lista-grabaciones {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 300px;
  overflow-y: auto;
}

.grabacion-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 10px;
}

.info {
  display: flex;
  gap: 15px;
  align-items: center;
  flex-wrap: wrap;
}

.duracion {
  color: #888;
  font-size: 0.85rem;
}

.btn-escuchar {
  padding: 6px 15px;
  background: #4a5568;
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
}

.btn-escuchar:hover {
  background: #2d3748;
}
</style>