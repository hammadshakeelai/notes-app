const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withShortNativePaths(config) {
  return withAppBuildGradle(config, mod => {
    if (!mod.modResults.contents.includes('CMAKE_OBJECT_PATH_MAX')) {
      mod.modResults.contents = mod.modResults.contents.replace('defaultConfig {', 'defaultConfig {\n        externalNativeBuild {\n            cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=240" }\n        }');
      mod.modResults.contents = mod.modResults.contents.replace('android {', 'android {\n    if (project.hasProperty("notesNativeBuildDir")) {\n        externalNativeBuild { cmake { buildStagingDirectory project.property("notesNativeBuildDir") } }\n    }');
    }
    return mod;
  });
};
