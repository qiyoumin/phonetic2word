import { createHash } from 'crypto';

export interface ManifestData {
  version: string;
  shards: string[];
}

/**
 * Generate a manifest from shard file contents.
 *
 * @param shardContents Map where keys are filenames (e.g. "index-AA.json")
 *                      and values are file content strings
 * @returns ManifestData with MD5 version hash and sorted shard filenames
 */
export function generateManifest(shardContents: Map<string, string>): ManifestData {
  const sortedNames = Array.from(shardContents.keys()).sort();
  const concatenated = sortedNames.map((name) => shardContents.get(name)!).join('');
  const version = createHash('md5').update(concatenated).digest('hex');
  return { version, shards: sortedNames };
}
