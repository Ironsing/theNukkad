import { mount } from 'svelte'
import { Capacitor } from '@capacitor/core'
import { configureAuth } from '@thenukkad/core'
import './app.css'
import App from './App.svelte'

// Where a logged-out outlet is sent when they land on a route that needs a
// session. The student app declares its own.
// Restaurant accounts are provisioned by hand, so this app has no signup or
// password reset screens yet; the delivery mode is set to match the student
// app so the first one added behaves the same on a phone.
configureAuth({
  signedOutRedirects: {
    '/home': '/login',
  },
  emailDelivery: Capacitor.isNativePlatform() ? 'code' : 'link',
})

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
