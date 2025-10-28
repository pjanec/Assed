<template>
  <v-app>
    <!-- Application Header -->
    <v-app-bar app color="primary" dark>
      <v-btn icon="mdi-arrow-left" @click="goHome" />
      <v-app-bar-title>Build & Release Hub</v-app-bar-title>
      <v-spacer />
      <v-btn prepend-icon="mdi-refresh" @click="buildsStore.fetchBuilds()" class="me-2">Refresh</v-btn>
      <v-btn prepend-icon="mdi-plus" color="accent" @click="openNewBuildDialog">New Build</v-btn>
    </v-app-bar>

    <!-- Main Content -->
    <v-main>
      <v-container fluid class="pa-4">
        <!-- Build Summary Cards -->
        <v-row class="mb-4">
            <v-col cols="12" sm="6" md="3"><v-card color="success" variant="tonal"><v-card-text><div class="d-flex align-center"><v-icon size="40" class="me-3">mdi-check-circle</v-icon><div><div class="text-h4">{{ buildStats.successful }}</div><div class="text-caption">Successful Builds</div></div></div></v-card-text></v-card></v-col>
            <v-col cols="12" sm="6" md="3"><v-card color="info" variant="tonal"><v-card-text><div class="d-flex align-center"><v-icon size="40" class="me-3">mdi-cog</v-icon><div><div class="text-h4">{{ buildStats.running }}</div><div class="text-caption">Running Builds</div></div></div></v-card-text></v-card></v-col>
            <v-col cols="12" sm="6" md="3"><v-card color="warning" variant="tonal"><v-card-text><div class="d-flex align-center"><v-icon size="40" class="me-3">mdi-clock-outline</v-icon><div><div class="text-h4">{{ buildStats.queued }}</div><div class="text-caption">Queued Builds</div></div></div></v-card-text></v-card></v-col>
            <v-col cols="12" sm="6" md="3"><v-card color="error" variant="tonal"><v-card-text><div class="d-flex align-center"><v-icon size="40" class="me-3">mdi-alert-circle</v-icon><div><div class="text-h4">{{ buildStats.failed }}</div><div class="text-caption">Failed Builds</div></div></div></v-card-text></v-card></v-col>
        </v-row>

        <!-- Builds Table -->
        <v-card>
            <v-card-title class="d-flex align-center"><v-icon class="me-2">mdi-history</v-icon>Recent Builds</v-card-title>
            <v-card-text>
                <v-list>
                    <v-list-item v-for="build in builds" :key="build.id" @click="viewBuildDetails(build)" class="border-b">
                        <template #prepend><v-avatar :color="getBuildStatusColor(build.status)" size="32"><v-icon :icon="getBuildStatusIcon(build.status)" /></v-avatar></template>
                        <v-list-item-title class="font-weight-medium">{{ build.distro }}</v-list-item-title>
                        <v-list-item-subtitle>#{{ build.id.split('-')[1] }} triggered by {{ build.triggeredBy }}</v-list-item-subtitle>
                        <template #append>
                            <div class="d-flex align-center ga-4" style="width: 300px;">
                                <div class="text-caption text-medium-emphasis text-right" style="width: 150px;">
                                    <div>{{ formatDateTime(build.startTime) }}</div>
                                    <div v-if="build.duration">{{ formatDuration(build.duration) }}</div>
                                </div>
                                <v-chip :color="getBuildStatusColor(build.status)" variant="flat" size="small">{{ build.status }}</v-chip>
                            </div>
                        </template>
                    </v-list-item>
                </v-list>
            </v-card-text>
        </v-card>
      </v-container>
    </v-main>

    <!-- Dialogs -->
    <v-dialog v-model="showBuildDetails" max-width="800px">
      <v-card v-if="selectedBuild">
        <v-card-title>Build Details: {{ selectedBuild.distro }}</v-card-title>
        <v-card-text>
            <v-list density="compact">
                <v-list-item title="Build ID" :subtitle="selectedBuild.id" />
                <v-list-item title="Commit Message" :subtitle="selectedBuild.commit" />
            </v-list>
          <h3 class="text-subtitle-1 mt-4 mb-2">Build Log</h3>
          <v-card color="black" class="pa-2">
            <pre class="text-caption" style="white-space: pre-wrap; word-break: break-all; color: #e0e0e0;">{{ selectedBuild.log }}</pre>
          </v-card>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn @click="showBuildDetails = false">Close</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showNewBuildDialog" max-width="500px" persistent>
      <v-card>
        <v-card-title>Start New Build</v-card-title>
        <v-card-text>
          <v-select v-model="newBuildForm.distroId" :items="availableDistros" item-title="assetKey" item-value="id" label="Distro" hint="Select the distro to build" persistent-hint />
          <v-textarea v-model="newBuildForm.commitMessage" label="Commit Message / Description" class="mt-4" rows="3" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showNewBuildDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="handleStartBuild" :disabled="!newBuildForm.distroId">Start Build</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useBuildsStore } from '@/core/stores/builds';
import { useAssetsStore } from '@/core/stores/assets';
import { storeToRefs } from 'pinia';
import { ASSET_TYPES } from '@/content/config/constants';

const router = useRouter();
const buildsStore = useBuildsStore();
const assetsStore = useAssetsStore();

const { builds, loading } = storeToRefs(buildsStore);

const showBuildDetails = ref(false);
const selectedBuild = ref(null);
const showNewBuildDialog = ref(false);
const newBuildForm = ref({
  distroId: null,
  commitMessage: 'Manual build from UI',
});

onMounted(() => {
  buildsStore.fetchBuilds();
  if (assetsStore.assets.length === 0) {
    assetsStore.loadAssets();
  }
});

onUnmounted(() => {
  buildsStore.stopPolling();
});

const availableDistros = computed(() => {
    return assetsStore.assets.filter(a => a.assetType === ASSET_TYPES.DISTRO);
});

const buildStats = computed(() => ({
    successful: builds.value.filter(b => b.status === 'Successful').length,
    running: builds.value.filter(b => b.status === 'Running').length,
    queued: builds.value.filter(b => b.status === 'Queued').length,
    failed: builds.value.filter(b => b.status === 'Failed').length
}));

const goHome = () => router.push('/');
const openNewBuildDialog = () => showNewBuildDialog.value = true;

const handleStartBuild = async () => {
  if (!newBuildForm.value.distroId) return;
  await buildsStore.startNewBuild(newBuildForm.value);
  showNewBuildDialog.value = false;
  newBuildForm.value = { distroId: null, commitMessage: 'Manual build from UI' };
};

const viewBuildDetails = (build) => {
  selectedBuild.value = build;
  showBuildDetails.value = true;
};

const getBuildStatusColor = (status) => ({ 'Successful': 'success', 'Running': 'info', 'Queued': 'warning', 'Failed': 'error' })[status] || 'grey';
const getBuildStatusIcon = (status) => ({ 'Successful': 'mdi-check-circle', 'Running': 'mdi-cog-sync', 'Queued': 'mdi-clock-outline', 'Failed': 'mdi-alert-circle' })[status] || 'mdi-help-circle';

const formatDuration = (ms) => {
  if (!ms) return '-';
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
};

const formatDateTime = (iso) => iso ? new Date(iso).toLocaleString() : '-';
</script>

<style scoped>
.border-b { border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.border-b:last-child { border-bottom: none; }
</style>
















