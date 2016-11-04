/* eslint-disable import/no-extraneous-dependencies, no-console */
import gulp from 'gulp';
import eslint from 'gulp-eslint';

const exec = require('child_process').exec;

function execResult(stderr, stdout) {
  console.log(`stdout: ${stdout}`);
  console.log(`stderr test: ${stderr}`);
}

gulp.task('build', (done) => {
  exec('npm run build', [], (error, stdout, stderr) => {
    execResult(stderr, stdout);
    done();
  });
});

gulp.task('default', gulp.series('build', () => (
  gulp.watch(['./lib/*.js', './test/index.js'], gulp.series('build', (done) => {
    exec('npm run build:test', (error, stdout, stderr) => {
      execResult(stderr, stdout);
      done();
    });
  }))
)));

gulp.task('eslint', () => (
  gulp.src(['./lib/*.js', './gulpfile.babel.js'])
    .pipe(eslint())
    .pipe(eslint.format())
));
