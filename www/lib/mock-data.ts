export interface Product {
  id: string
  name: string
  description: string
  price: number
  image: string
  category: string
}

export interface Restaurant {
  id: string
  slug: string
  name: string
  category: string
  image: string
  logo: string
  deliveryTime: string
  deliveryFee: number
  rating: number
  isOpen: boolean
  isNew: boolean
  description: string
  products: Product[]
}

export interface OrderStatus {
  label: string
  time: string
  done: boolean
}

export interface Order {
  id: string
  restaurantName: string
  items: { name: string; quantity: number; price: number }[]
  subtotal: number
  deliveryFee: number
  total: number
  address: string
  eta: string
  statuses: OrderStatus[]
}

export const restaurants: Restaurant[] = [
  {
    id: "1",
    slug: "smash-burger",
    name: "Smash Burger",
    category: "Burgers",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80",
    logo: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=200&q=80",
    deliveryTime: "20-30 min",
    deliveryFee: 2.90,
    rating: 4.8,
    isOpen: true,
    isNew: false,
    description: "Des smash burgers juteux, écrasés à la perfection sur la plancha.",
    products: [
      { id: "sb-1", name: "Classic Smash", description: "Steak haché 120g, cheddar fondu, oignons caramélisés, sauce maison", price: 9.90, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80", category: "Burgers" },
      { id: "sb-2", name: "Double Smash", description: "Double steak 240g, double cheddar, pickles, sauce BBQ", price: 13.90, image: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&q=80", category: "Burgers" },
      { id: "sb-3", name: "Chicken Smash", description: "Poulet croustillant, salade, tomate, sauce ranch", price: 10.90, image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&q=80", category: "Burgers" },
      { id: "sb-4", name: "Frites Maison", description: "Frites fraîches coupées à la main", price: 4.50, image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&q=80", category: "Sides" },
      { id: "sb-5", name: "Onion Rings", description: "Rondelles d'oignons panées et croustillantes", price: 5.50, image: "https://images.unsplash.com/photo-1639024471283-03518883512d?w=400&q=80", category: "Sides" },
      { id: "sb-6", name: "Milkshake Vanille", description: "Milkshake onctueux à la vanille de Madagascar", price: 6.90, image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&q=80", category: "Boissons" },
      { id: "sb-7", name: "Coca-Cola", description: "33cl", price: 2.50, image: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=400&q=80", category: "Boissons" },
    ],
  },
  {
    id: "2",
    slug: "tacos-factory",
    name: "Tacos Factory",
    category: "Tacos & Wraps",
    image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80",
    logo: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=200&q=80",
    deliveryTime: "25-35 min",
    deliveryFee: 2.90,
    rating: 4.6,
    isOpen: true,
    isNew: true,
    description: "Tacos français généreux avec des sauces exclusives.",
    products: [
      { id: "tf-1", name: "Tacos L", description: "Viande au choix, frites, fromage fondu, sauce algérienne", price: 8.90, image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&q=80", category: "Tacos" },
      { id: "tf-2", name: "Tacos XL", description: "Double viande, frites, fromage, 2 sauces au choix", price: 11.90, image: "https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=400&q=80", category: "Tacos" },
      { id: "tf-3", name: "Tacos XXL", description: "Triple viande, frites, fromage, toutes les sauces", price: 14.90, image: "https://images.unsplash.com/photo-1624996379697-f01d168b1a52?w=400&q=80", category: "Tacos" },
      { id: "tf-4", name: "Wrap Poulet", description: "Poulet grillé, crudités, sauce blanche", price: 7.90, image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&q=80", category: "Wraps" },
      { id: "tf-5", name: "Nuggets x10", description: "Nuggets de poulet croustillants", price: 6.50, image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&q=80", category: "Sides" },
      { id: "tf-6", name: "Ice Tea Pêche", description: "33cl", price: 2.50, image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80", category: "Boissons" },
    ],
  },
  {
    id: "3",
    slug: "pizza-napoli",
    name: "Pizza Napoli",
    category: "Pizzas",
    image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=80",
    logo: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200&q=80",
    deliveryTime: "30-40 min",
    deliveryFee: 1.90,
    rating: 4.9,
    isOpen: true,
    isNew: false,
    description: "Pizzas artisanales cuites au feu de bois, pâte 48h de fermentation.",
    products: [
      { id: "pn-1", name: "Margherita", description: "Sauce tomate, mozzarella fior di latte, basilic frais", price: 10.90, image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=80", category: "Pizzas" },
      { id: "pn-2", name: "Regina", description: "Sauce tomate, mozzarella, jambon, champignons", price: 12.90, image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80", category: "Pizzas" },
      { id: "pn-3", name: "4 Fromages", description: "Mozzarella, gorgonzola, parmesan, chèvre", price: 13.90, image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80", category: "Pizzas" },
      { id: "pn-4", name: "Calzone", description: "Pizza pliée, jambon, mozzarella, œuf, crème", price: 13.90, image: "https://images.unsplash.com/photo-1536964549204-cce9eab227bd?w=400&q=80", category: "Pizzas" },
      { id: "pn-5", name: "Tiramisu", description: "Tiramisu maison au mascarpone et café", price: 6.90, image: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400&q=80", category: "Desserts" },
      { id: "pn-6", name: "Eau San Pellegrino", description: "50cl", price: 3.00, image: "https://images.unsplash.com/photo-1560023907-5f339617ea55?w=400&q=80", category: "Boissons" },
    ],
  },
  {
    id: "4",
    slug: "sushi-zen",
    name: "Sushi Zen",
    category: "Japonais",
    image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&q=80",
    logo: "https://images.unsplash.com/photo-1583623025817-d180a2221d0a?w=200&q=80",
    deliveryTime: "25-35 min",
    deliveryFee: 3.90,
    rating: 4.7,
    isOpen: false,
    isNew: false,
    description: "Sushis et makis premium préparés minute avec du poisson frais.",
    products: [
      { id: "sz-1", name: "Plateau Découverte", description: "6 makis saumon, 6 makis thon, 4 california rolls", price: 18.90, image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&q=80", category: "Plateaux" },
      { id: "sz-2", name: "Plateau Premium", description: "8 sashimis, 6 nigiri, 8 makis variés", price: 24.90, image: "https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=400&q=80", category: "Plateaux" },
      { id: "sz-3", name: "California Rolls x8", description: "Avocat, saumon fumé, cream cheese", price: 11.90, image: "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=400&q=80", category: "Rolls" },
      { id: "sz-4", name: "Edamame", description: "Fèves de soja grillées au sel de mer", price: 4.90, image: "https://images.unsplash.com/photo-1564834744159-ff0ea41ba4b9?w=400&q=80", category: "Entrées" },
      { id: "sz-5", name: "Mochi x3", description: "Glaces mochi : mangue, matcha, fraise", price: 6.50, image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&q=80", category: "Desserts" },
      { id: "sz-6", name: "Thé Matcha", description: "Thé matcha cérémonial", price: 4.50, image: "https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=400&q=80", category: "Boissons" },
    ],
  },
]

export const mockAddressSuggestions = [
  "12 Avenue de la Costa, Monaco",
  "25 Boulevard Albert 1er, Monaco",
  "8 Rue Grimaldi, Monaco",
  "3 Avenue Saint-Charles, Monaco",
  "17 Rue Princesse Caroline, Monaco",
]

export const mockOrder: Order = {
  id: "BDY-2026-001",
  restaurantName: "Smash Burger",
  items: [
    { name: "Classic Smash", quantity: 2, price: 9.90 },
    { name: "Frites Maison", quantity: 1, price: 4.50 },
    { name: "Coca-Cola", quantity: 2, price: 2.50 },
  ],
  subtotal: 29.30,
  deliveryFee: 2.90,
  total: 32.20,
  address: "12 Avenue de la Costa, Monaco",
  eta: "20-30 min",
  statuses: [
    { label: "Commande reçue", time: "12:30", done: true },
    { label: "En préparation", time: "12:32", done: true },
    { label: "En livraison", time: "12:50", done: false },
    { label: "Livrée", time: "~13:00", done: false },
  ],
}
