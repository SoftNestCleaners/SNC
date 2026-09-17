/**
 * SoftNest Cleaners — prices
 *
 * Edit prices here, not in index.html. Each service below has a list
 * of [label, price] rows and an optional note shown under the table.
 * Save this file and refresh the page — no HTML editing needed.
 *
 * The "key" on the left (upholstery, carpet, rug, ...) must match the
 * data-service="..." attribute on that service's card in index.html —
 * don't rename keys unless you also update index.html to match.
 */
const PRICES = {
  upholstery: {
    rows: [
      ["Armchair", "$60"],
      ["Loveseat, 2 seats", "$100"],
      ["Sofa, 3 seats", "$140"],
      ["Sectional, 4+ seats", "$170"],
    ],
    note: "Final price depends on fabric and condition.",
  },
  carpet: {
    rows: [
      ["Single room, up to 200 sq ft", "$100"],
      ["Each additional room", "$80"],
      ["Hallway", "$45"],
      ["Staircase, up to 14 steps", "$60"],
    ],
    note: "Three rooms or more booked together are quoted as a package.",
  },
  rug: {
    rows: [
      ["Small, up to 5×8", "$70"],
      ["Medium, 8×10", "$100"],
      ["Large, 9×12", "$130"],
      ["Custom size", "on request"],
    ],
    note: "Delicate fibers are assessed before we start.",
  },
  mattress: {
    rows: [
      ["Twin", "$60"],
      ["Full", "$80"],
      ["Queen", "$90"],
      ["King", "$130"],
    ],
    note: "Deep steam extraction reaches down into the mattress layers, not just the surface.",
  },
  car: {
    rows: [
      ["Sedan", "$130"],
      ["SUV, 2 rows", "$160"],
      ["SUV or van, 3 rows", "$190"],
    ],
    note: "We come to you — driveway or parking spot is enough.",
  },
  custom: {
    rows: [
      ["Dining chairs, per chair", "$40"],
      ["Office chair", "$45"],
      ["Headboard", "from $60"],
      ["Anything unusual", "on request"],
    ],
    note: "Not sure it can be cleaned? Ask before you replace it.",
  },
};
