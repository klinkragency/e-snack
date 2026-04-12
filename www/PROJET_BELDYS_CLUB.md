# PROJET BELDY’S CLUB

## 1. PITCH (10–15 lignes)

**BELDY’S CLUB** est la nouvelle plateforme de référence pour commander vos repas préférés à Monaco. Conçue comme un "Club Gourmand" digital, elle centralise l'offre des 4 enseignes phares du groupe (Smash Burger, Tacos Factory, Healthy Bowls, Sweet Corner) au sein d'une interface unique, fluide et moderne.
Plus qu'une simple app de commande, BELDY’S CLUB offre une expérience unifiée : un seul compte client, un panier multi-marques, et un suivi de livraison en temps réel, le tout avec la "Vibe Pop" caractéristique de la marque Beldy's.
L'objectif est double : simplifier la vie des clients monégasques en leur offrant le meilleur de la street food en quelques clics (livraison ou retrait), et optimiser la logistique interne pour garantir des plats chauds et livrés rapidement.
Avec une architecture scalable, BELDY’S CLUB est prêt à accueillir de nouvelles marques futures, transformant chaque repas en une expérience exclusive et maîtrisée de A à Z.

---

## 2. CAHIER DES CHARGES SYNTHÉTIQUE

### A. Proposition de Valeur
- **Centralisation** : 4 marques, 1 application.
- **Expérience Utilisateur** : UI/UX inspirée des leaders (UberEats/Deliveroo) mais adaptée à l'identité Beldy's.
- **Service** : Livraison rapide (Monaco + limitrophe) ou Click & Collect.

### B. Cibles
- Résidents monégasques et travailleurs pendulaires.
- Amateurs de street food de qualité (15-45 ans).
- Habitués des plateformes de livraison cherchant une alternative locale et fiable.

### C. Règles Métier
- **Zones de livraison** : Monaco, Beausoleil, Cap d'Ail (paramétrable).
- **Minimum de commande** : 15€ (variable selon zone).
- **Frais de livraison** : Calcul dynamique (distance) ou forfaitaire. Gratuit > 50€.
- **Horaires** : Gestion des créneaux d'ouverture par marque (ex: Tacos 11h-23h, Burgers 11h-15h / 19h-23h).

### D. Stack Technique & Exigences
- **Frontend** : Next.js (App Router), Tailwind CSS, Framer Motion (simulé ici par CSS), Radix UI.
- **Backend (à développer)** : Node.js/NestJS ou Supabase/Firebase.
- **Performance** : Core Web Vitals (LCP < 2.5s), Optimisation images.
- **Sécurité** : Auth sécurisée, Paiement Stripe/Mollie, RGPD compliant.

---

## 3. FEATURES LIST (MVP)

**Client (Web/Mobile)**
- [ ] Authentification (Email/Tel + OTP).
- [ ] Page d'accueil "Bento Grid" (Mise en avant des marques).
- [ ] Page Restaurant (Menu, Catégories, Options produits).
- [ ] Panier global (gestion des quantités, suppléments).
- [ ] Checkout (Adresse, Paiement CB, Choix créneau).
- [ ] Suivi de commande (Statuts : En cuisine -> En route -> Livré).
- [ ] Compte client (Historique, Adresses favorites).

**Admin Back-Office**
- [ ] Dashboard (Commandes du jour, CA).
- [ ] Gestion du catalogue (Produits, Prix, Stock).
- [ ] Gestion des commandes (Accepter, Refuser, Assigner livreur).

**Restaurant / Cuisine**
- [ ] Tablette de réception des commandes.
- [ ] Ticket cuisine (Impression automatique).

---

## 4. ARBORESCENCE D'ÉCRANS

1.  **Splash Screen / Landing** : Présentation du concept (Bento Grid).
2.  **Auth** : Login / Register.
3.  **Home (Dashboard)** : Liste des Restaurants, Promos du jour.
4.  **Restaurant Details** :
    *   Header (Image, Infos, Note).
    *   Menu (Liste produits par catégorie).
    *   Modal Produit (Choix options, Sauces).
5.  **Panier (Drawer/Page)** : Récapitulatif, Vente additionnelle (Upsell).
6.  **Checkout** :
    *   Adresse (Map/Input).
    *   Créneau (ASAP / Planifié).
    *   Paiement.
7.  **Success / Tracking** : Map live (MVP: Statut textuel), Ref tirelire/fidélité.
8.  **Profile** : Mes commandes, Mes infos, Support.

---

## 5. ROADMAP (MVP 4-6 SEMAINES)

- **Semaine 1-2** : Design UI (Figma) & Setup Projet (Next.js, Base de données).
- **Semaine 3** : Développement Catalogue & Panier.
- **Semaine 4** : Intégration Paiement & Checkout.
- **Semaine 5** : Back-office Admin & Gestion commandes.
- **Semaine 6** : Tests (QA), Raccordement imprimantes tickets, Déploiement.
