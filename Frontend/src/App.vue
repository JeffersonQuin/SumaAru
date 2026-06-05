<template>
  <div class="app">
    <GrabadoraVoz />
  </div>
</template>

<script setup>
import GrabadoraVoz from './components/GrabadoraVoz.vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

.app {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}
</style>