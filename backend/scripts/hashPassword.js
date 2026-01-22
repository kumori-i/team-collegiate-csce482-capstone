// Script to hash a password for database entry
import bcrypt from "bcrypt";

const password = process.argv[2];

if (!password) {
  console.error("Usage: node scripts/hashPassword.js <password>");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
console.log("\nPassword hash:");
console.log(hash);
console.log("\nYou can now update your MongoDB document:");
console.log(`db.users.updateOne({ email: "test@example.com" }, { $set: { passwordHash: "${hash}" } })`);
console.log("\nOr use MongoDB Compass/Atlas to update the passwordHash field with the value above.\n");
