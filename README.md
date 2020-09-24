LEGv8 Simulator
===============

A simulator for a 1 MB RAM, little endian based LEGv8 computer.

Opcode encodings are from [here](https://www.eecs.umich.edu/courses/eecs370/eecs370.f20/resources/materials/ARM-v8-Quick-Reference-Guide.pdf.)

## Assembly Syntax

Each line of assembly is in the form
`{label{:}} {instruction|pseudoinstruction|directive} {;comment}`. Labels may have but are not required to have a
 colon after them, and can only have alphanumber characters.

Instructions supported by this simulator are:

- Arithmetic:

`ADD
ADDS
ADDI
ADDIS`

`SUB
SUBS
SUBI
SUBIS`

- Load/store:

`LDUR
LDURSW
LDURH
LDURB`

`STUR
STURH
STURB
STURW`

`MOVZ
MOVK`

- Logical operators:

`AND
ANDI
ORR
ORRI
EOR
EORI
LSL
LSR`

- Branches:

`B
BR
BL
CBZ
CBNZ
B.cond`
where `cond = EQ, NE, LT, LE, GT, GE, MI, PL, VS, LO, LS, HI, HS, AL`.

Pseudoinstructions supported by this simulator are:

+ `MOV Xd Xn = ORR Xd XZR Xn`
+ `MOV Xd #uimm12 = ORRI Xd XZR #uimm12`
+ `CMP Xn Xm = SUBS XZR Xn Xm`

Directives supported by this simulator are:
+ `% [numbytes]`
+ `FILL [numbytes] {0xgg} {0xhh} ...`
+ `ALIGN`

## Documentation for instructions outside LEGv8:

### `B.AL`
Always takes the branch. Performs the same function as `B`.

### `% [numbytes]`
Reserves `numbytes` bytes of space, initialized with the value 0. For example, calling `% 8` could give something
 such as
 
 | Memory Address | Value |
 | :------------: | :---- |
 |     &0x80      | 0x00  |
 |     &0x81      | 0x00  |
 |     &0x82      | 0x00  |
 |     &0x83      | 0x00  |
 |     &0x84      | 0x00  |
 |     &0x85      | 0x00  |
 |     &0x86      | 0x00  |
 |     &0x87      | 0x00  |

### `FILL [numbytes] {0xgg} {0xhh} ...`
Reserves `numbytes` bytes of space, where the first one has the value `0xgg`, the second has the value `0xhh`, and so
 on. For example, calling `FILL 8 0x00 0x44 0x88 0xCC` could give something such as
 
 | Memory Address | Value |
 | :------------: | :---- |
 |     &0x80      | 0x00  |
 |     &0x81      | 0x44  |
 |     &0x82      | 0x88  |
 |     &0x83      | 0xcc  |
 |     &0x84      | 0x00  |
 |     &0x85      | 0x44  |
 |     &0x86      | 0x88  |
 |     &0x87      | 0xcc  |

### `ALIGN`
Doesn't reserve any memory, but aligns the memory address of the next instruction to the next multiple of 4. Can be
 used after `%` or `FILL` to make sure that instructions are aligned. If instructions aren't properly aligned
 , undefined behavior can occur.
