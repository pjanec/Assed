import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomeWorkspace from '@/content/views/HomeWorkspace.vue'
import { useAssetsStore } from '@/core/stores/assets';
import { useWorkspaceStore } from '@/core/stores/workspace';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home',
    component: HomeWorkspace
  },
  {
    path: '/editor',
    name: 'Editor',
    component: () => import('@/content/views/EditorWorkbench.vue'),
    props: true,
    // Add the navigation guard here
    async beforeEnter(to, from, next) {
      const assetsStore = useAssetsStore();
      const workspaceStore = useWorkspaceStore();

      // Only run this heavy logic if the assets aren't already loaded
      if (assetsStore.assets.length === 0) {
        console.log('Router Guard: Loading and normalizing assets...');
        await assetsStore.loadAssets();
      }
      
      // Proceed with navigation to the component
      next();
    }
  },
  {
    path: '/build-release',
    name: 'BuildRelease',
    component: () => import('@/content/views/BuildReleaseHub.vue')
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
















