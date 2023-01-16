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

import 'jasmine';
import {EventEmitter} from 'events';
import {getFeature, parse, INVALID, processTextRange} from '../src/lib.js';

class Character {
  noBreak = false;
  otherAttributes: {[keys: string]: string | number | boolean} = {};
  private _contents: string;
  private _eventEmitter: EventEmitter;

  constructor(contents: string, eventEmitter: EventEmitter) {
    this._contents = contents;
    this._eventEmitter = eventEmitter;
  }

  get contents() {
    return this._contents;
  }

  set contents(contents: string) {
    this._contents = contents;
    this._eventEmitter.emit('characterChanged');
  }

  clone(newContents?: string) {
    const clone = new Character(
      newContents ? newContents : this._contents,
      this._eventEmitter
    );
    clone.noBreak = this.noBreak;
    clone.otherAttributes = this.otherAttributes;
    return clone;
  }
}

class TextRangeMock implements TextRange {
  characters: Character[] = [];
  private _eventEmitter = new EventEmitter();

  constructor() {
    // Makes sure that each character has only one character in its contents.
    this._eventEmitter.on('characterChanged', () => {
      const newCharacters: Character[] = [];
      this.characters.forEach(character => {
        for (let i = 0; i < character.contents.length; i++) {
          newCharacters.push(character.clone(character.contents[i]));
        }
      });
      this.characters = newCharacters;
    });
  }

  get noBreak() {
    return this.characters.every(c => c.noBreak);
  }

  set noBreak(value: boolean) {
    this.characters.forEach(c => {
      c.noBreak = value;
    });
  }

  get contents() {
    return this.characters.map(c => c.contents).join('');
  }

  set contents(input: string) {
    this.characters = input
      .split('')
      .map(c => new Character(c, this._eventEmitter));
  }
}

describe('getFeature', () => {
  const feature = getFeature('a', 'b', 'c', 'd', 'e', 'f');

  it('should include certain features.', () => {
    expect(feature).toContain('UW1:a');
    expect(feature).toContain('BW1:bc');
    expect(feature).toContain('TW1:abc');
  });
});

describe('Parser.getFeature with invalid inputs.', () => {
  const feature = getFeature('a', 'a', INVALID, 'a', 'a', 'a');
  const findByPrefix = (prefix: string, feature: string[]) => {
    for (const item of feature) {
      if (item.startsWith(prefix)) return true;
    }
    return false;
  };
  it('should not include invalid features.', () => {
    expect(findByPrefix('UW3:', feature)).toBeFalse();
    expect(findByPrefix('BW2:', feature)).toBeFalse();
  });
});

describe('parse', () => {
  const TEST_SENTENCE = 'abcdeabcd';

  it('should separate if a strong feature item supports.', () => {
    const model = {'UW4:a': 10000}; // means "should separate right before 'a'".
    const result = parse(model, TEST_SENTENCE);
    expect(result).toEqual(['abcde', 'abcd']);
  });

  it('should separate even if it makes a phrase of one character.', () => {
    const model = {'UW4:b': 10000}; // means "should separate right before 'b'".
    const result = parse(model, TEST_SENTENCE);
    expect(result).toEqual(['a', 'bcdea', 'bcd']);
  });

  it('should return an empty list when the input is a blank string.', () => {
    const result = parse({}, '');
    expect(result).toEqual([]);
  });
});

describe('processTextRange', () => {
  it('Phrases should be glued by the separator.', () => {
    const textRange = new TextRangeMock();
    textRange.contents = 'abcdeabcd';
    const separator = '-';
    processTextRange({'UW4:a': 10000}, textRange, separator);
    expect(textRange.contents).toBe('abcde' + separator + 'abcd');
  });

  it('Every character should have noBreak true, but not the separator.', () => {
    const textRange = new TextRangeMock();
    textRange.contents = 'abcdeabcd';
    processTextRange({'UW4:a': 10000}, textRange, ' ');
    expect(textRange.characters.map(character => character.noBreak)).toEqual([
      true, // a
      true, // b
      true, // c
      true, // d
      true, // e
      false, // SEPARATOR
      true, // a
      true, // b
      true, // c
      true, // d
    ]);
  });

  it('The separator should be one character.', () => {
    const textRange = new TextRangeMock();
    textRange.contents = 'abcdeabcd';
    expect(() => {
      processTextRange({'UW4:a': 10000}, textRange, 'SEP');
    }).toThrowError();
  });
});
