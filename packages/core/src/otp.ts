// The code that collects something, as every side of both pools knows it: four
// digits, none of them a leading zero. Its own module because it is the one thing
// the two pools share - an order's code and a request's code are the same kind of
// thing, minted separately, and neither pool's file is a reasonable place to keep
// the other's knowledge of it.
//
// The name is the column's, `otp`; the word a counter says is "code", which is what
// the function here is called. The column's own check is the same one, said here so
// a counter can be told a typo is a typo without a round trip.
export function isCode(value: string): boolean {
    return /^[1-9][0-9]{3}$/.test(value);
}
