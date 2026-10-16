import { mount } from 'svelte'
import { Capacitor } from '@capacitor/core'
import { configureAuth } from '@thenukkad/core'
import './app.css'
import App from './App.svelte'

// Where a logged-out student is sent when they land on a route that needs a
// session. The restaurant app declares its own.
// The native apps get the code out of the confirmation and recovery emails
// instead of the link, which can't redirect back into the WebView.
configureAuth({
  signedOutRedirects: {
    '/home': '/login',
    '/reset-password': '/login',
  },
  emailDelivery: Capacitor.isNativePlatform() ? 'code' : 'link',
})

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
