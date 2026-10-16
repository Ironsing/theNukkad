import { mount } from 'svelte'
import { Capacitor } from '@capacitor/core'
import { configureAuth } from '@thenukkad/core'
import './app.css'
import App from './App.svelte'

// The restaurant app serves restaurant accounts; the student app declares its
// own role. Everything below is what a page can't know on its own.
// Restaurant accounts are provisioned by hand, so this app has no signup or
// password reset screens yet; the delivery mode is set to match the student
// app so the first one added behaves the same on a phone.
configureAuth({
  role: 'restaurant',
  signedOutRedirects: {
    '/home': '/login',
  },
  codeDelivery: Capacitor.isNativePlatform() ? 'manual' : 'link',
})

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
