import { mount } from 'svelte'
import { Capacitor } from '@capacitor/core'
import { configureAuth } from '@thenukkad/core'
import './app.css'
import App from './App.svelte'

// The student app serves student accounts; the restaurant app declares its own
// role. Everything below is what a page can't know on its own.
// The native apps get the code out of the confirmation and recovery emails
// instead of the link, which can't redirect back into the WebView.
configureAuth({
  role: 'student',
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
