module.exports = (api) => {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [require("./plugins/lucide-deep-imports")],
  };
};
