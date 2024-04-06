import { Bundle } from "./bundle";

export const rollup = async (entry: string, outputFilename: string) => {
  const bundle = new Bundle({ entry });
  await bundle.build(outputFilename);
};
