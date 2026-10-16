<script lang="ts">
    import Router from "svelte-spa-router";
    import { replace } from "svelte-spa-router";
    import { wrap } from "svelte-spa-router/wrap";
    import Login from "./pages/Login.svelte";
    import Home from "./pages/Home.svelte";
    import { isAuthenticated, requireSession } from "@thenukkad/core";

    const routes = {
        "/": wrap({
            // The router requires a component here, and the condition below never
            // lets it render: this route only picks a destination.
            component: Login,
            conditions: [
                async () => {
                    if (await isAuthenticated()) {
                        replace("/home");
                        return false;
                    }

                    replace("/login");
                    return false;
                },
            ],
        }),
        "/login": Login,
        "/home": wrap({
            component: Home,
            conditions: [requireSession("/home")],
        }),
    };
</script>

<Router {routes} />
