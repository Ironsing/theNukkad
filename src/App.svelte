<script lang="ts">
    import Router from "svelte-spa-router";
    import { replace } from "svelte-spa-router";
    import { wrap } from "svelte-spa-router/wrap";
    import Login from "./pages/Login.svelte";
    import Signup from "./pages/Signup.svelte";
    import Welcome from "./pages/Welcome.svelte";
    import { isAuthenticated } from "./lib/auth";

    const routes = {
        "/": wrap({
            component: Login,
            conditions: [
                () => {
                    replace("/login");
                    return false;
                },
            ],
        }),
        "/login": Login,
        "/signup": Signup,
        "/welcome": wrap({
            component: Welcome,
            conditions: [
                async () => {
                    if (!(await isAuthenticated())) {
                        replace("/login");
                        return false;
                    }

                    return true;
                },
            ],
        }),
    };
</script>

<Router {routes} />
