import { mount } from 'svelte'
import { Capacitor } from '@capacitor/core'
import {
  configureCodeDelivery,
  enableRedirectsOnAuthChanges,
} from '@thenukkad/core'
import './app.css'
import App from './App.svelte'

// The routes this app has, and where a signed-out visitor belongs on each: what
// a page can't know on its own. Restaurant accounts are provisioned by hand, so
// there is no password reset screen yet; the route is still named so that a
// recovery session has somewhere to land once one is added.
enableRedirectsOnAuthChanges({
  home: '/home',
  resetPassword: '/reset-password',
  signedOutRedirects: {
    '/': '/login',
    '/home': '/login',
  },
})

// Matches the student app, so that a first password reset screen behaves the
// same on a phone.
configureCodeDelivery(Capacitor.isNativePlatform() ? 'manual' : 'link')

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
