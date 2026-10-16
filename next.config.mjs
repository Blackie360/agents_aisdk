/** @type {import('next').NextConfig} */
export default {
  serverExternalPackages: [
    "@mrleebo/prisma-ast",
    "pgsql-ast-parser",
    "node-sql-parser",
  ],
};
