
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const geolib = require('geolib');
const express = require('express');
const cors = require('cors');

// Token do bot
const token = '7550422055:AAFhlqxuhs599Qc4qbziSyv5GlrcH7gt8fY';
const bot = new TelegramBot(token, { polling: true });

// Express app para webhook (opcional)
const app = express();
app.use(cors());
app.use(express.json());

// Armazenamento temporário de dados do usuário
const userSessions = new Map();

// Classe principal do otimizador de rotas
class RouteOptimizer {
  constructor() {
    this.geocodeCache = new Map();
  }

  // Geocodificação usando OpenStreetMap (gratuito)
  async geocodeAddress(address) {
    if (this.geocodeCache.has(address)) {
      return this.geocodeCache.get(address);
    }

    try {
      const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
