/*
 * @author: ruka-lang
 * @created: 2024-02-28
 */

use crate::prelude::*;

use std::sync::Arc;

//pub enum Node {
//    Program(Program),
//    Statement(Statement)
//}

#[derive(Debug)]
pub enum Expression {
    Unit,
    Tag(Arc<str>),
    Integer(Box<str>),
    Float(Box<str>),
    Boolean(bool),
    Block(Block),
    If(Box<If>),
    Match(Box<Match>),
    Fn(Box<Fn>),
    Closure(Box<Closure>),
    FnCall(Box<FnCall>),
    Prefix(Box<Prefix>),
    Infix(Box<Infix>),
    Postfix(Box<Postfix>)
}

#[derive(Debug)]
pub struct If {
    pub condition: Expression,
    pub consequence: Expression,
    pub alternative: Expression
}

#[derive(Debug)]
pub struct Match {
    pub value: Expression,
    pub cases: Vec<Case>
}

#[derive(Debug)]
pub struct Case {
    pub condition: Expression,
    pub consequence: Expression
}

#[derive(Debug)]
pub struct Fn {
    pub name: Arc<str>,
    pub parameters: Vec<Arc<str>>,
    pub block: Expression,
    pub arity: usize
}

#[derive(Debug)]
pub struct Closure {
    pub name: Arc<str>,
    pub parameters: Vec<Arc<str>>,
    pub block: Expression,
    pub context: Vec<Arc<str>>,
    pub arity: usize
}

#[derive(Debug)]
pub struct FnCall {
    pub func: Expression,
    pub args: Vec<Expression>
}

#[derive(Debug)]
pub struct Prefix {
    pub operator: TokenType,
    pub value: Expression
}

#[derive(Debug)]
pub struct Infix {
    pub operator: TokenType,
    pub lhs: Expression,
    pub rhs: Expression
}

#[derive(Debug)]
pub struct Postfix {
    pub operator: TokenType,
    pub value: Expression
}

#[derive(Debug)]
pub enum Statement {
    Binding,
    Return(Expression),
    Expression(Expression)
}

#[derive(Debug)]
pub struct Binding {
    pub kind: TokenType,
    pub name: Arc<str>,
    pub value: Expression
}

#[derive(Debug)]
pub struct Block {
    pub statements: Vec<Statement>
}

#[derive(Debug)]
pub struct Program {
    pub statements: Vec<Statement>
}
