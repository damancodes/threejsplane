import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  //add host 
  server:{
    allowedHosts:['d1d0972f0fd6.ngrok-free.app']
  }

});
