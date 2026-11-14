import { createRouter, createWebHashHistory, type RouteLocationNormalized } from 'vue-router'
import SeriesListView from './views/SeriesListView.vue'
import SeriesDetailView from './views/SeriesDetailView.vue'
import SeriesFormView from './views/SeriesFormView.vue'
import ShoppingView from './views/ShoppingView.vue'
import SettingsView from './views/SettingsView.vue'

// Views receive what they need as props, so they do not read the route themselves.
const seriesId = (route: RouteLocationNormalized) => ({ id: Number(route.params.id) })
const initialTitle = (route: RouteLocationNormalized) => ({ initialTitle: route.query.title?.toString() })

// Hash history works on any static host without redirect rules. Views are
// imported statically (no lazy loading) so the whole app is in the offline precache.
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'series-list', component: SeriesListView },
    { path: '/series/new', name: 'series-new', component: SeriesFormView, props: initialTitle },
    { path: '/series/:id(\\d+)', name: 'series-detail', component: SeriesDetailView, props: seriesId },
    { path: '/series/:id(\\d+)/edit', name: 'series-edit', component: SeriesFormView, props: seriesId },
    { path: '/shopping', name: 'shopping', component: ShoppingView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  // Back/forward restores the previous scroll position; new pages start at the top.
  scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? { top: 0 },
})
