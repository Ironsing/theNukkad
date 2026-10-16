import { mount } from 'svelte'
import { configureAuth } from '@thenukkad/core'
import './app.css'
import App from './App.svelte'

// Where a logged-out outlet is sent when they land on a route that needs a
// session. The student app declares its own.
configureAuth({
  signedOutRedirects: {
    '/home': '/restologin',
  },
})

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
