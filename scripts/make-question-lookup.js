const fs = require("fs");

function writeImageFilesLookup() {
  // TODO check for edge cases
  const imageFiles = fs
    .readdirSync("./src/assets/images/questions")
    .filter(d => d.indexOf("x") === -1)
    .map(d => {
      const sp = d.slice(0, -4).split("-");
      if (sp.length === 1 || sp[1].length < 4) {
        // question UID has - character
        // not actually multiple questions
        return { [d.slice(0, -4)]: d };
      }
      return sp.reduce((t, v) => ({ ...t, [v]: d }), {});
    })
    .reduce((t, v) => ({ ...t, ...v }), {});

  fs.writeFileSync(
    "./src/assets/data/imageFilesLookup.json",
    JSON.stringify(imageFiles)
  );
}

writeImageFilesLookup();
