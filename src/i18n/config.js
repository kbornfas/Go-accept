import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Common
      "welcome": "Welcome",
      "loading": "Loading...",
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete",
      "edit": "Edit",
      "search": "Search",
      "filter": "Filter",
      "export": "Export",
      
      // Auth
      "login": "Login",
      "logout": "Logout",
      "password": "Password",
      "forgotPassword": "Forgot Password?",
      "resetPassword": "Reset Password",
      
      // Escrow
      "escrow": "Escrow",
      "escrows": "Escrows",
      "createEscrow": "Create Escrow",
      "escrowId": "Escrow ID",
      "amount": "Amount",
      "status": "Status",
      "platform": "Platform",
      "paymentMethods": "Payment Methods",
      "releaseFunds": "Release Funds",
      
      // Wallet
      "wallet": "Wallet",
      "balance": "Balance",
      "deposit": "Deposit",
      "withdraw": "Withdraw",
      "transfer": "Transfer",
      
      // Status
      "held": "Held",
      "approved": "Approved",
      "released": "Released",
      "refunded": "Refunded",
      "disputed": "Disputed",
      "cancelled": "Cancelled",
      
      // Dashboard
      "dashboard": "Dashboard",
      "analytics": "Analytics",
      "totalVolume": "Total Volume",
      "activeEscrows": "Active Escrows",
      "completedEscrows": "Completed Escrows"
    }
  },
  es: {
    translation: {
      // Common
      "welcome": "Bienvenido",
      "loading": "Cargando...",
      "save": "Guardar",
      "cancel": "Cancelar",
      "delete": "Eliminar",
      "edit": "Editar",
      "search": "Buscar",
      "filter": "Filtrar",
      "export": "Exportar",
      
      // Auth
      "login": "Iniciar sesión",
      "logout": "Cerrar sesión",
      "password": "Contraseña",
      "forgotPassword": "¿Olvidaste tu contraseña?",
      "resetPassword": "Restablecer contraseña",
      
      // Escrow
      "escrow": "Depósito en garantía",
      "escrows": "Depósitos",
      "createEscrow": "Crear depósito",
      "escrowId": "ID de depósito",
      "amount": "Cantidad",
      "status": "Estado",
      "platform": "Plataforma",
      "paymentMethods": "Métodos de pago",
      "releaseFunds": "Liberar fondos",
      
      // Wallet
      "wallet": "Billetera",
      "balance": "Saldo",
      "deposit": "Depositar",
      "withdraw": "Retirar",
      "transfer": "Transferir",
      
      // Status
      "held": "Retenido",
      "approved": "Aprobado",
      "released": "Liberado",
      "refunded": "Reembolsado",
      "disputed": "Disputado",
      "cancelled": "Cancelado",
      
      // Dashboard
      "dashboard": "Panel",
      "analytics": "Analíticas",
      "totalVolume": "Volumen total",
      "activeEscrows": "Depósitos activos",
      "completedEscrows": "Depósitos completados"
    }
  },
  fr: {
    translation: {
      // Common
      "welcome": "Bienvenue",
      "loading": "Chargement...",
      "save": "Enregistrer",
      "cancel": "Annuler",
      "delete": "Supprimer",
      "edit": "Modifier",
      "search": "Rechercher",
      "filter": "Filtrer",
      "export": "Exporter",
      
      // Auth
      "login": "Connexion",
      "logout": "Déconnexion",
      "password": "Mot de passe",
      "forgotPassword": "Mot de passe oublié?",
      "resetPassword": "Réinitialiser le mot de passe",
      
      // Escrow
      "escrow": "Séquestre",
      "escrows": "Séquestres",
      "createEscrow": "Créer un séquestre",
      "escrowId": "ID séquestre",
      "amount": "Montant",
      "status": "Statut",
      "platform": "Plateforme",
      "paymentMethods": "Méthodes de paiement",
      "releaseFunds": "Libérer les fonds",
      
      // Wallet
      "wallet": "Portefeuille",
      "balance": "Solde",
      "deposit": "Dépôt",
      "withdraw": "Retrait",
      "transfer": "Transfert",
      
      // Status
      "held": "Retenu",
      "approved": "Approuvé",
      "released": "Libéré",
      "refunded": "Remboursé",
      "disputed": "Contesté",
      "cancelled": "Annulé",
      
      // Dashboard
      "dashboard": "Tableau de bord",
      "analytics": "Analytique",
      "totalVolume": "Volume total",
      "activeEscrows": "Séquestres actifs",
      "completedEscrows": "Séquestres terminés"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('language') || 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
