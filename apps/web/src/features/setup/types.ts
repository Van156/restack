import type { AppRouterClient } from "@base-template/api/routers/index";

type RestaurantClient = AppRouterClient["restaurant"];

export type AreaView = Awaited<ReturnType<RestaurantClient["areas"]["list"]>>[number];
export type TableView = Awaited<ReturnType<RestaurantClient["tables"]["list"]>>[number];
export type StationView = Awaited<ReturnType<RestaurantClient["stations"]["list"]>>[number];
export type MenuCategoryView = Awaited<
  ReturnType<RestaurantClient["menu"]["categories"]["list"]>
>[number];
/** A Menu item as the setup screens see it (restaurant-wide, with cost and derived tax). */
export type SetupMenuItemView = Awaited<
  ReturnType<RestaurantClient["menu"]["items"]["list"]>
>[number];
/** The Menu as one Location sees it: categories with routing and sold-out flags. */
export type LocationMenuView = Awaited<ReturnType<RestaurantClient["menu"]["list"]>>;
export type SetupReviewView = Awaited<ReturnType<RestaurantClient["setup"]["review"]>>;
