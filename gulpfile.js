const gulp = require("gulp");
const workbox = require("workbox-build");
const uglifyes = require('uglify-es');
const composer = require('gulp-uglify/composer');
const uglify = composer(uglifyes, console);
const pipeline = require('readable-stream').pipeline;
const cleanCSS = require('gulp-clean-css')
const htmlmin = require('gulp-htmlmin')
const htmlclean = require('gulp-htmlclean')
//const uglify = require('gulp-uglify')

// 设置根目录
const root = './public'

// 匹配模式， **/*代表匹配所有目录下的所有文件
const pattern = '**/*'
gulp.task('minify-html', function() {
  return gulp
    // 匹配所有 .html结尾的文件
    .src(`${root}/${pattern}.html`)
    .pipe(htmlclean())
    .pipe(
      htmlmin({
        removeComments: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true
      })
    )
    .pipe(gulp.dest('./public'))
})

// 压缩css
gulp.task('minify-css', function() {
  return gulp
    // 匹配所有 .css结尾的文件
    .src(`${root}/${pattern}.css`)
    .pipe(
      cleanCSS({
        compatibility: 'ie8'
      })
    )
    .pipe(gulp.dest('./public'))
})

// 压缩js
gulp.task('minify-js', function() {
  return gulp
    // 匹配所有 .js结尾的文件
    .src(`${root}/${pattern}.js`)
    .pipe(
      babel({
        presets: ['env']
      })
    )
    .pipe(uglify())
    .pipe(gulp.dest('./public'))
})

gulp.task('generate-service-worker', () => {
    return workbox.injectManifest({
        swSrc: './sw-template.js',
        swDest: './public/sw.js',
        globDirectory: './public',
        globPatterns: [
            "**/*.{html,css,js,json,woff2}"
        ],
        modifyURLPrefix: {
            "": "./"
        }
    });
});

gulp.task("uglify", function () {
    return pipeline(
        gulp.src("./public/sw.js"),
        uglify(),
        gulp.dest("./public")
    );
});

//gulp.task("build", gulp.series("generate-service-worker", "uglify"));
 
gulp.task('build', gulp.series('generate-service-worker', 'minify-css', 'uglify'))
