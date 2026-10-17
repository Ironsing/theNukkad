import { mount } from 'svelte'
import { Capacitor } from '@capacitor/core'
import {
  configureCodeDelivery,
  enableRedirectsOnAuthChanges,
} from '@thenukkad/core'
import './app.css'
import App from './App.svelte'

// The routes this app has, and where a signed-out visitor belongs on each: what
// a page can't know on its own.
enableRedirectsOnAuthChanges({
  home: '/home',
  resetPassword: '/reset-password',
  signedOutRedirects: {
    '/home': '/login',
    '/reset-password': '/login',
  },
})

// The native app gets a code out of the confirmation and recovery emails
// instead of the link, which can't redirect back into the WebView.
configureCodeDelivery(Capacitor.isNativePlatform() ? 'manual' : 'link')

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
