module.exports = {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          // viewBox is required to resize SVGs with CSS.
          // Remove it make SVG become VG!!!
          // @see https://github.com/svg/svgo/issues/1128
          // FIXME: This change has been included in 4.0.0
          // @see https://github.com/svg/svgo/pull/1461
          removeViewBox: false,
          // Required by BIMI.
          removeTitle: false,
        },
      },
    },
  ],
};
