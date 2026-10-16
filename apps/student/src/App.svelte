<script lang="ts">
    import Router from "svelte-spa-router";
    import { replace } from "svelte-spa-router";
    import { wrap } from "svelte-spa-router/wrap";
    import StudentLogin from "./pages/StudentLogin.svelte";
    import StudentSignup from "./pages/StudentSignup.svelte";
    import Home from "./pages/Home.svelte";
    import Onboarding from "./pages/Onboarding.svelte";
    import ResetPassword from "./pages/ResetPassword.svelte";
    import { isAuthenticated, requireSession } from "@thenukkad/core";

    const routes = {
        "/": wrap({
            component: Onboarding,
            conditions: [
                async () => {
                    if (await isAuthenticated()) {
                        replace("/home");
                        return false;
                    }

                    replace("/onboard");
                    return false;
                },
            ],
        }),
        "/onboard": Onboarding,
        "/studentlogin": StudentLogin,
        "/studentsignup": StudentSignup,
        "/reset-password": wrap({
            component: ResetPassword,
            conditions: [requireSession("/reset-password")],
        }),
        "/home": wrap({
            component: Home,
            conditions: [requireSession("/home")],
        }),
    };
</script>

<Router {routes} />
