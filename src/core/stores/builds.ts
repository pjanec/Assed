// File: ./src/stores/builds.ts

import { defineStore } from 'pinia';
import { useCoreConfigStore } from './config';
import type { Build } from '@/core/types';

// The state interface has been updated
interface BuildsState {
  builds: Build[];
  loading: {
    list: boolean;
  };
  pollingInterval: ReturnType<typeof setInterval> | null;
}

export const useBuildsStore = defineStore('builds', {
  state: (): BuildsState => ({
    builds: [],
    // The loading state is now a consistent object
    loading: {
      list: false,
    },
    pollingInterval: null,
  }),

  getters: {
    runningBuilds: (state): Build[] => state.builds.filter(b => ['Running', 'Queued'].includes(b.status)),
  },

  actions: {
    async fetchBuilds(): Promise<void> {
      this.loading.list = true;
      try {
        const coreConfig = useCoreConfigStore();
        if (!coreConfig.persistenceAdapter) throw new Error("Persistence adapter not registered.");
        const fetchedBuilds = await coreConfig.persistenceAdapter.loadBuilds();
        this.builds = fetchedBuilds.sort((a: Build, b: Build) => 
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        this.startPolling();
      } catch (error) {
        console.error('Failed to fetch builds:', error);
      } finally {
        this.loading.list = false;
      }
    },

    async startBuild(payload: any): Promise<string> {
      try {
        const coreConfig = useCoreConfigStore();
        if (!coreConfig.persistenceAdapter) throw new Error("Persistence adapter not registered.");
        const { buildId } = await coreConfig.persistenceAdapter.startBuild(payload);
        await this.fetchBuilds(); // Refresh the list after starting a new build
        return buildId;
      } catch (error) {
        console.error('Failed to start new build:', error);
        throw error;
      }
    },

    startPolling(): void {
      if (this.pollingInterval) clearInterval(this.pollingInterval);
      if (this.runningBuilds.length > 0) {
        this.pollingInterval = setInterval(async () => {
          const coreConfig = useCoreConfigStore();
          if (!coreConfig.persistenceAdapter) {
            this.stopPolling();
            return;
          }
          const updatedBuilds = await coreConfig.persistenceAdapter.loadBuilds();
          this.builds = updatedBuilds.sort((a: Build, b: Build) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
          if (this.runningBuilds.length === 0) this.stopPolling();
        }, 3000);
      }
    },

    stopPolling(): void {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
        console.log('Build polling stopped.');
      }
    },
  },
});







