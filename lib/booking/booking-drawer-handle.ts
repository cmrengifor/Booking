import { Drawer } from "@base-ui/react/drawer";

/**
 * Links every "Reservar" button on the site (header, hero, service cards —
 * wherever a <BookingTrigger> is rendered) to the one global booking drawer
 * mounted in the salon layout, without prop-drilling a ref through every
 * page in between. See components/public-site/global-booking-drawer.tsx.
 */
export const bookingDrawerHandle = Drawer.createHandle();
