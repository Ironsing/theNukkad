export * from './auth';
export * from './auth_routing';
export {
    Restaurants,
    restaurants,
    fold,
    type Restaurant,
    type RestaurantChange,
    type RestaurantStatus,
} from './restaurants';
export { MyRestaurant, myRestaurant, type RestaurantDraft } from './my_restaurant';
export {
    MenuReader,
    diets,
    dietLabels,
    dietFlags,
    dietFlagLabels,
    dietFlagMeanings,
    foldMenuItems,
    isDiet,
    menuSections,
    rupees,
    type Diet,
    type DietFlag,
    type MenuItem,
    type MenuItemChange,
    type MenuSection,
} from './menu_reader';
export {
    MenuEditor,
    menuEditor,
    type NewMenuItem,
    type MenuItemEdit,
} from './menu_editor';
export { logoUrl, menuItemPhotoUrl } from './photos';
export {
    MyOrders,
    myOrders,
    lineTotal,
    orderTotal,
    type NewOrder,
    type NewOrderLine,
    type Order,
    type OrderLine,
} from './my_orders';
// The one thing the two pools share: what a code looks like, whichever table it was
// minted into. Out here rather than inside either pool's exports, because the counter
// asks it about a code it has not looked up yet and does not know the kind of.
export { isCode } from './otp';
export { IncomingOrders, incomingOrders } from './incoming_orders';
export {
    MyPreorders,
    myPreorders,
    isPreorderStatus,
    preorderStatuses,
    preorderStatusLabels,
    preorderTotal,
    type NewPreorder,
    type NewPreorderLine,
    type Preorder,
    type PreorderLine,
    type PreorderStatus,
} from './my_preorders';
export { IncomingPreorders, incomingPreorders } from './incoming_preorders';
export { findTicketByCode, type Ticket } from './tickets';
export { supabase } from './supabase';
