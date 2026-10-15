<script lang="ts">
    import Router from "svelte-spa-router";
    import { replace } from "svelte-spa-router";
    import { wrap } from "svelte-spa-router/wrap";
    import Login from "./pages/Login.svelte";
    import Signup from "./pages/Signup.svelte";
    import Welcome from "./pages/Welcome.svelte";
    import ResetPassword from "./pages/ResetPassword.svelte";
    import { isAuthenticated } from "./lib/auth";

    const routes = {
        "/": wrap({
            component: Login,
            conditions: [
                async () => {
                    if (await isAuthenticated()) {
                        replace("/welcome");
                        return false;
                    }

                    replace("/login");
                    return false;
                },
            ],
        }),
        "/login": Login,
        "/signup": Signup,
        "/reset-password": wrap({
            component: ResetPassword,
            conditions: [
                async () => {
                    // Needs the recovery session a reset link produces. Without
                    // one there is nothing to reset, and updateUser would fail.
                    if (!(await isAuthenticated())) {
                        replace("/login");
                        return false;
                    }

                    return true;
                },
            ],
        }),
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
