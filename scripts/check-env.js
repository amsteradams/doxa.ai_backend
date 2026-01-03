#!/usr/bin/env node
// Script pour vérifier la configuration .env

const path = require('path');
const fs = require('fs');

console.log('🔍 Diagnostic de la configuration .env\n');

// 1. Vérifier le répertoire courant
const cwd = process.cwd();
console.log(`📁 Répertoire courant: ${cwd}`);

// 2. Chercher le fichier .env
const possiblePaths = [
  path.join(cwd, '.env'),
  path.join(cwd, '..', '.env'),
  path.join(cwd, 'backend', '.env'),
];

console.log('\n🔎 Recherche du fichier .env:');
let envPath = null;
for (const envFile of possiblePaths) {
  const exists = fs.existsSync(envFile);
  console.log(`  ${exists ? '✅' : '❌'} ${envFile}`);
  if (exists && !envPath) {
    envPath = envFile;
  }
}

if (!envPath) {
  console.log('\n❌ Aucun fichier .env trouvé!');
  process.exit(1);
}

console.log(`\n✅ Fichier .env trouvé: ${envPath}`);

// 3. Lire le contenu
console.log('\n📄 Contenu du fichier .env:');
const envContent = fs.readFileSync(envPath, 'utf-8');
console.log('---');
console.log(envContent);
console.log('---');

// 4. Vérifier DATABASE_URL
console.log('\n🔍 Vérification de DATABASE_URL:');
const lines = envContent.split('\n');
let hasDatabaseUrl = false;
let databaseUrlLine = null;

for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('DATABASE_URL')) {
    hasDatabaseUrl = true;
    databaseUrlLine = trimmed;
    break;
  }
}

if (hasDatabaseUrl) {
  console.log(`  ✅ DATABASE_URL trouvé: ${databaseUrlLine.substring(0, 50)}...`);
  
  // Vérifier le format
  if (databaseUrlLine.includes('=')) {
    const value = databaseUrlLine.split('=')[1].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      console.log('  ✅ Format correct (entre guillemets)');
    } else if (value.startsWith("'") && value.endsWith("'")) {
      console.log('  ✅ Format correct (entre apostrophes)');
    } else {
      console.log('  ⚠️  Format: pas de guillemets (peut fonctionner)');
    }
    
    if (value.includes('your_database_url') || value.includes('localhost') && value.includes('doxa')) {
      console.log('  ⚠️  ATTENTION: DATABASE_URL semble être un template, vérifiez la valeur!');
    }
  }
} else {
  console.log('  ❌ DATABASE_URL non trouvé dans le fichier .env!');
}

// 5. Tester le chargement avec dotenv
console.log('\n🧪 Test du chargement avec dotenv:');
try {
  require('dotenv').config({ path: envPath });
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    console.log(`  ✅ DATABASE_URL chargé: ${dbUrl.substring(0, 30)}...`);
  } else {
    console.log('  ❌ DATABASE_URL non chargé par dotenv');
  }
} catch (error) {
  console.log(`  ❌ Erreur lors du chargement: ${error.message}`);
}

// 6. Vérifier depuis le répertoire du seed
console.log('\n📂 Test depuis le répertoire du seed:');
const seedDir = path.join(cwd, 'prisma', 'seeds');
const seedEnvPath = path.join(cwd, '.env');
console.log(`  Répertoire seed: ${seedDir}`);
console.log(`  .env depuis seed: ${seedEnvPath}`);
console.log(`  Existe: ${fs.existsSync(seedEnvPath) ? '✅' : '❌'}`);

console.log('\n✨ Diagnostic terminé');

