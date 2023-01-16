/**
 * @license
 * Copyright 2022 Google LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export const INVALID = '▔';

export const ZWSP = '​';

/**
 * Generates a feature from characters around (w1-w6) in a compatible way with
 * the target environment.
 *
 * @param w1 The character 3 characters before the break point.
 * @param w2 The character 2 characters before the break point.
 * @param w3 The character right before the break point.
 * @param w4 The character right after the break point.
 * @param w5 The character 2 characters after the break point.
 * @param w6 The character 3 characters after the break point.
 * @returns A feature to be consumed by a classifier.
 */
export const getFeature = (
  w1: string,
  w2: string,
  w3: string,
  w4: string,
  w5: string,
  w6: string
) => {
  const out: string[] = [];
  if (w1 !== INVALID) out.push(`UW1:${w1}`);
  if (w2 !== INVALID) out.push(`UW2:${w2}`);
  if (w3 !== INVALID) out.push(`UW3:${w3}`);
  if (w4 !== INVALID) out.push(`UW4:${w4}`);
  if (w5 !== INVALID) out.push(`UW5:${w5}`);
  if (w6 !== INVALID) out.push(`UW6:${w6}`);
  if (w2 !== INVALID && w3 !== INVALID) out.push(`BW1:${w2 + w3}`);
  if (w3 !== INVALID && w4 !== INVALID) out.push(`BW2:${w3 + w4}`);
  if (w4 !== INVALID && w5 !== INVALID) out.push(`BW3:${w4 + w5}`);
  if (w1 !== INVALID && w2 !== INVALID && w3 !== INVALID)
    out.push(`TW1:${w1 + w2 + w3}`);
  if (w2 !== INVALID && w3 !== INVALID && w4 !== INVALID)
    out.push(`TW2:${w2 + w3 + w4}`);
  if (w3 !== INVALID && w4 !== INVALID && w5 !== INVALID)
    out.push(`TW3:${w3 + w4 + w5}`);
  if (w4 !== INVALID && w5 !== INVALID && w6 !== INVALID)
    out.push(`TW4:${w4 + w5 + w6}`);
  return out;
};

/**
 * Parses the input sentence and returns a list of semantic chunks in a
 * compatible way with the target environment.
 *
 * @param model A BudouX model.
 * @param sentence An input sentence.
 * @returns The retrieved chunks.
 */
export const parse = (model: {[keys: string]: number}, sentence: string) => {
  if (sentence === '') return [];
  const result = [sentence[0]];
  let baseScore = 0;
  for (const featureKey in model) {
    // eslint-disable-next-line no-prototype-builtins
    if (!model.hasOwnProperty(featureKey)) continue;
    baseScore -= model[featureKey];
  }

  for (let i = 1; i < sentence.length; i++) {
    let score = baseScore;
    const feature = getFeature(
      sentence[i - 3] || INVALID,
      sentence[i - 2] || INVALID,
      sentence[i - 1],
      sentence[i],
      sentence[i + 1] || INVALID,
      sentence[i + 2] || INVALID
    );
    for (let j = 0; j < feature.length; j++) {
      score += 2 * (model[feature[j]] || 0);
    }
    if (score > 0) result.push('');
    result[result.length - 1] += sentence[i];
  }
  return result;
};

/**
 * Processes a TextRange to wrap phrases not to be broken.
 *
 * @param model A BudouX model.
 * @param textRange A TextRange.
 * @param separator A separater character.
 */
export const processTextRange = (
  model: {[keys: string]: number},
  textRange: TextRange,
  separator: string
) => {
  if (separator.length !== 1) {
    throw new Error('The separator should be one character.');
  }
  const phrases = parse(model, textRange.contents.replace(separator, ''));
  textRange.contents = phrases.join(separator);
  textRange.noBreak = true;
  let n = 0;
  for (let i = 0; i < phrases.length - 1; i++) {
    n += phrases[i].length;
    textRange.characters[n].noBreak = false;
    n += 1;
  }
};

/**
 * The entry point.
 *
 * @param model A BudouX model.
 * @param separator The character to separate phrases.
 */
export const run = (model: {[keys: string]: number}, separator = ZWSP) => {
  const selection = app.activeDocument.selection;

  // No object selected.
  if (selection === null) return;

  // A TextRange is selected.
  // eslint-disable-next-line no-prototype-builtins
  if (selection.hasOwnProperty('contents')) {
    processTextRange(model, selection as TextRange, separator);
    return;
  }

  const selectedItems = selection as (TextFrame | MiscItem)[];
  for (let i = 0; i < selectedItems.length; i++) {
    const item = selectedItems[i];
    if (item.contents === undefined) continue;
    processTextRange(model, item.textRange, separator);
  }
};
