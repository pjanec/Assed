<template>
  <v-app>
    <v-app-bar
      app
      color="primary"
      dark
    >
      <v-app-bar-title>
        {{ config.appTitle }}
      </v-app-bar-title>
      
      <v-spacer />
      
      <v-chip
        variant="outlined"
        color="white"
      >
        v{{ config.version }}
      </v-chip>
    </v-app-bar>

    <v-main>
      <v-container fluid class="pa-6">
        <!-- Page Header -->
        <div class="mb-6">
          <h1 class="text-h3 font-weight-light mb-2">
            Welcome to Asset Editor
          </h1>
          <p class="text-h6 text-medium-emphasis">
            Manage your distro configurations with ease
          </p>
        </div>

        <v-row>
          <!-- Quick Actions -->
          <v-col cols="12" md="4">
            <v-card class="h-100" elevation="2">
              <v-card-title>
                <v-icon class="me-2">mdi-lightning-bolt</v-icon>
                Actions
              </v-card-title>
              
              <v-card-text>
                <div class="d-flex flex-column ga-3">
                  <v-btn
                    size="large"
                    color="primary"
                    variant="elevated"
                    prepend-icon="mdi-pencil"
                    @click="openEditor"
                    block
                  >
                    Open Editor
                  </v-btn>
                  
                  <v-btn
                    size="large"
                    color="accent"
                    variant="elevated" 
                    prepend-icon="mdi-rocket-launch"
                    @click="openBuildHub"
                    block
                  >
                    Build & Release Hub
                  </v-btn>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <!-- Project Overview -->
          <v-col cols="12" md="8">
            <v-card elevation="2">
              <v-card-title>
                <v-icon class="me-2">mdi-chart-donut</v-icon>
                Project Overview
              </v-card-title>
              
              <v-card-text v-if="loading.assets">
                <div class="d-flex justify-center py-4">
                  <v-progress-circular indeterminate color="primary" />
                </div>
              </v-card-text>
              
              <v-card-text v-else-if="assets.length === 0" class="text-center py-8">
                <v-icon size="64" color="grey-lighten-1" class="mb-4">
                  mdi-folder-open-outline
                </v-icon>
                <p class="text-body-1 text-medium-emphasis">
                  No assets found in this project.
                </p>
              </v-card-text>
              
              <v-list v-else>
                <v-list-item
                  v-for="(stat, index) in projectStats.filter(s => s.count > 0)"
                  :key="index"
                  class="border-b"
                >
                  <template #prepend>
                    <v-avatar :color="stat.color" size="40">
                      <v-icon>{{ stat.icon }}</v-icon>
                    </v-avatar>
                  </template>

                  <v-list-item-title class="font-weight-medium">
                    {{ stat.count }} {{ stat.label }}
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAssetsStore } from '@/core/stores'
import { storeToRefs } from 'pinia'
import { config } from '@/config'

const router = useRouter()
const assetsStore = useAssetsStore()

const { assets, loading, projectStats } = storeToRefs(assetsStore)

onMounted(async () => {
  if (assets.value.length === 0) {
    await assetsStore.loadAssets();
  }
})

// Action handlers
const openEditor = () => {
  router.push('/editor')
}

const openBuildHub = () => {
  router.push('/build-release')
}

</script>

<style scoped>
.border-b {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.border-b:last-child {
  border-bottom: none;
}
</style>
















