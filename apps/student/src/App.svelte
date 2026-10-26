<script lang="ts">
    import Router from "svelte-spa-router";
    import { wrap } from "svelte-spa-router/wrap";
    import Login from "./pages/Login.svelte";
    import Signup from "./pages/Signup.svelte";
    import Home from "./pages/Home.svelte";
    import Menu from "./pages/Menu.svelte";
    import Orders from "./pages/Orders.svelte";
    import Preorder from "./pages/Preorder.svelte";
    import Preorders from "./pages/Preorders.svelte";
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
        "/signup": Signup,
        "/reset-password": wrap({
            component: ResetPassword,
            conditions: [requireSignedIn("/reset-password")],
        }),
        "/home": wrap({
            component: Home,
            conditions: [requireSignedIn("/home")],
        }),
        // One outlet's menu. The page reads the outlet's id from the route.
        "/menu/:id": wrap({
            component: Menu,
            conditions: [requireSignedIn("/menu/:id")],
        }),
        // The student's own orders, and the code for one of them.
        "/orders": wrap({
            component: Orders,
            conditions: [requireSignedIn("/orders")],
        }),
        // Asking an outlet for something for later. The page reads the outlet's
        // id from the route, as the menu does, and asks the same menu for it.
        "/preorder/:id": wrap({
            component: Preorder,
            conditions: [requireSignedIn("/preorder/:id")],
        }),
        // What was asked for, and the code for the ones that are ready.
        "/preorders": wrap({
            component: Preorders,
            conditions: [requireSignedIn("/preorders")],
        }),
    };
</script>

<Router {routes} />
