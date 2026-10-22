<script lang="ts">
    import Router from "svelte-spa-router";
    import { wrap } from "svelte-spa-router/wrap";
    import Login from "./pages/Login.svelte";
    import Home from "./pages/Home.svelte";
    import Orders from "./pages/Orders.svelte";
    import ResetPassword from "./pages/ResetPassword.svelte";
    import { redirectSignedInTo, requireSignedIn } from "@thenukkad/core";

    const routes = {
        "/": wrap({
            // The router requires a component here, and the condition below never
            // lets it render: this route only picks a destination.
            component: Login,
            conditions: [redirectSignedInTo("/home")],
        }),
        "/login": Login,
        "/reset-password": wrap({
            component: ResetPassword,
            conditions: [requireSignedIn("/reset-password")],
        }),
        "/home": wrap({
            component: Home,
            conditions: [requireSignedIn("/home")],
        }),
        // What the outlet is here for: orders to cook, and codes to check.
        "/orders": wrap({
            component: Orders,
            conditions: [requireSignedIn("/orders")],
        }),
    };
</script>

<Router {routes} />
