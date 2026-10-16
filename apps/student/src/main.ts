import { mount } from 'svelte'
import { configureAuth } from '@thenukkad/core'
import './app.css'
import App from './App.svelte'

// Where a logged-out student is sent when they land on a route that needs a
// session. The restaurant app declares its own.
configureAuth({
  signedOutRedirects: {
    '/home': '/onboard',
    '/reset-password': '/studentlogin',
  },
})

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
