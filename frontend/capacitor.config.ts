import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.meleflow.app",
  appName: "MeleFlow",
  webDir: "dist",
  server: {
    androidScheme: "http",
    cleartext: true,
    allowNavigation: ["*"],
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon",
      iconColor: "#8B5CF6",
    },
    StatusBar: {
      overlaysWebView: true,
      style: "DARK",
      backgroundColor: "#00000000",
    },
  },
};

export default config;
