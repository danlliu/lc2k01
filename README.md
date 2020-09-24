LEGv8 Simulator
===============

A simulator for a 1 MB RAM, little endian based LEGv8 computer.

Opcode encodings are from [here](https://www.eecs.umich.edu/courses/eecs370/eecs370.f20/resources/materials/ARM-v8-Quick-Reference-Guide.pdf.)

## Assembly Syntax

Each line of assembly is in the form
`{label:} {instruction|pseudoinstruction|directive}`. Labels are required to have a colon after them.

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
where `cond = EQ, NE, LT, LE, GT, GE, MI, PL, VS, LO, LS, HI, or HS`.

Pseudoinstructions supported by this simulator are:

+ `MOV Xd Xn = ORR Xd XZR Xn`
+ `MOV Xd #uimm12 = ORRI Xd XZR #uimm12`
+ `CMP Xn Xm = SUBS XZR Xn Xm`

Directives supported by this simulator are:
+ `% [numbytes]`
