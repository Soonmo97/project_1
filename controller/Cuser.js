const { Op } = require("sequelize");
// const { session }  = require("../session");
const { User, Restaurant, Review, Category } = require("../models");
const bcrypt = require("bcrypt");
const { render } = require("ejs");
const nodemailer = require("nodemailer");
const { smtpTransport } = require("../config/email");
const { response } = require("express");

// GET /index
exports.getMain = async (req, res) => {
    try {
        const user = req.session.user;
        const { category } = req.query;

        const restaurants = await Restaurant.findAll({
            attributes: ["rest_index", "rest_name"],
        });

        const indexReview = await Restaurant.findAll({
            attributes: ["rest_index", "rest_name"],
            include: {
                model: Review,
                attributes: ["review_rating"],
            },
        });
        
        if (user) {
            res.render("index", {
                isLogin: true,
                user: user,
                restaurants: restaurants,
                indexReview: indexReview,
                category: category,
            });
        } else {
            res.render("index", {
                isLogin: false,
                restaurants: restaurants,
                indexReview: indexReview,
                category: category,
            });
        }
      
    } catch (error) {
        console.error("데이터 불러오기 오류:", error);
        res.status(500).send("Internal Server Error");
    }
};


// POST /include/header/form/login
exports.loginHeader = async (req, res) => {
    console.log("세션 정보 >> ", req.session);

    const { id, pw } = req.body;

    try {
        const user = await User.findOne({ where: { id } });
        if (user && (await bcrypt.compare(pw, user.pw))) {
            req.session.user = user.id; // 세션에 유저 정보 저장
            req.session.index = user.user_index; // 세션 인덱스 저장 값
            console.log("세션 연결 완료>>  ", req.session.index);
            res.redirect("/");
        } else {
            res.send(`<script>
            alert("아이디 또는 비밀번호가 일치하지 않습니다.");
            window.location.href = "/";
            </script>`);
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send("로그인 오류");
    }
};

// POST /include/header/form/register
exports.registerHeader = async (req, res) => {
    const { id, pw, nickname, email } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(pw, 10);
        const user = await User.findOne({ where: { id } });

        console.log("회원 정보 >> ", user);
        // 기존 아이디와 가입 아이디를 비교해서 찾는 user가 null 값인 경우,
        // 중복되지 않는다는 뜻이기 때문에 가입 허용
        if (user === null) {
            await User.create({
                id: req.body.id,
                pw: hashedPassword,
                nickname: req.body.nickname,
                email: req.body.email,
            }).then((result) => {
                // console.log("회원가입 완료!!", result.id);
                console.log("회원가입 완료 >>", result.id); //result.id = id
                res.redirect("/");
            });
        } else {
            console.log("중복된 아이디 입니다.");
            res.render("index", { isLogin: false });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("회원가입 실패");
    }
};

// GET /user/login
exports.getLogin = async (req, res) => {
    res.render("user/login");
};

exports.postLogin = async (req, res) => {
    console.log("세션 정보 >> ", req.session);

    const { id, pw } = req.body;

    try {
        const user = await User.findOne({ where: { id } });
        if (user && (await bcrypt.compare(pw, user.pw))) {
            req.session.user = user.id; // 세션에 유저 정보 저장
            req.session.index = user.user_index; // 세션 인덱스 저장 값

            console.log("세션 연결 완료>>  ", req.session.index);

            res.render("index", { isLogin: true, user: id });
        } else {
            // res.send(`<script>
            // alert("아이디 또는 비밀번호가 일치하지 않습니다.");
            // </script>`);
            res.render("index", { isLogin: false });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send("로그인 오류");
    }
};

// POST /include/header/form_logout
exports.logoutHeader = async (req, res) => {
    if (req.session.user) {
        req.session.destroy((err) => {
            if (err) {
                res.status(500).send("로그아웃 중 오류 발생");
            } else {
                res.redirect("/");
            }
        });
    } else {
        // 세션에 사용자 정보가 없는 경우
        console.log("이미 세션 만료된 회원입니다.");
        res.redirect("/");
    }
};

// POST /user/idCheckFrom/checkForm
exports.checkId = async (req, res) => {
    const { id } = req.body;

    try {
        const user = await User.findOne({ where: { id: id } });

        if (user) {
            console.log("아이디 사용 불가능 입니다.");
            res.send({ available: false }); // 아이디 사용 불가능을 클라이언트에게 전달합니다.
        } else {
            console.log("아이디 사용 가능 입니다.");
            res.send({ available: true }); // 아이디 사용 가능을 클라이언트에게 전달합니다.
        }
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: "서버 오류" }); // 서버 오류를 클라이언트에게 반환합니다.
    }
};

// GET /user/idCheckForm
exports.checkWindow = async (req, res) => {
    res.render("user/idCheckForm");
};

// POST /form/sendCode
exports.sendCode = async (req, res) => {
    // 인증 코드 생성
    const generateRandomNumber = (min, max) => {
        const randNum = Math.floor(Math.random() * (max - min + 1)) + min;
        console.log("랜덤 숫자 >>> ", randNum);
        return randNum;
    };
    const number = generateRandomNumber(111111, 999999).toString();
    const hashAuth = bcrypt.hashSync(number, 10);
    const { email } = req.body;
    req.session.hashAuth = hashAuth;
    console.log("코드 숫자 >>> ", hashAuth);

    // 메일 형식
    const mailOptions = {
        from: process.env.USER_EMAIL,
        to: email,
        subject: "창동역 맛집 모음 CMM 회원가입 메일입니다.",
        text: "인증번호는" + number + "입니다.",
        html:
            "<div style='font-family: 'Apple SD Gothic Neo', 'sans-serif' !important; width: 540px; height: 600px; border-top: 4px solid #348fe2; margin: 100px auto; padding: 30px 0; box-sizing: border-box;'>" +
            "<h1 style='margin: 0; padding: 0 5px; font-size: 28px; font-weight: 400;'>" +
            "<span style='font-size: 15px; margin: 0 0 10px 3px;'></span><br />" +
            "<b><span style='color: #ffc064;'>CMM 인증번호</span></b> 안내입니다." +
            "</h1>" +
            "<p style='font-size: 16px; line-height: 26px; margin-top: 50px; padding: 0 5px;'>" +
            "<img src='https://img1.daumcdn.net/thumb/R1280x0/?scode=mtistory2&fname=https%3A%2F%2Fblog.kakaocdn.net%2Fdn%2FbDgQle%2FbtsFLrbDpSQ%2F5C4uYWS4rOjSPhsryeVtcK%2Fimg.png'/><br /><br /><br />"+
            "안녕하세요.<br />" +
            "요청하신 인증번호가 생성되었습니다.<br />" +
            "감사합니다." +
            "</p>" +
            "<p style='font-size: 16px; margin: 40px 5px 20px; line-height: 28px;'>" +
            "인증번호: <br />" +
            "<span style='font-size: 24px;'>" +
            number +
            "</span>" +
            "</p>" +
            "<div style='border-top: 1px solid #DDD; padding: 5px;'>" +
            "</div>" +
            "</div>",
    };

    // const user = await User.findOne({ where: { email: email } });

    const emailCk = await User.findOne({ where: { email: email } });
    console.log("이메일 중복이 있나요? >>", emailCk);
    if (emailCk === null) {
        await smtpTransport.sendMail(mailOptions, (err, response) => {
            console.log("response", response);
            if (err) {
                res.send({ ok: false, msg: " 메일 전송에 실패하였습니다." });
            } else {
                res.send({ ok: true, msg: " 메일 전송에 성공하였습니다." });
            }
            smtpTransport.close(); //전송종료
        });
    } else {
        res.send({ check: true });
    }
};
// POST /form/checkCode
exports.checkCode = async (req, res) => {
    const { codeValue } = req.body;
    console.log("세션 값: ", req.session);

    const hashAuth = req.session.hashAuth;

    console.log("입력한 코드 값 :: ", req.body);

    // 클라이언트로부터 받은 코드 값과 이메일로 전송된 인증번호를 비교
    if (bcrypt.compareSync(codeValue, hashAuth)) {
        console.log("인증번호 일치");
        res.json({ ok: true, msg: "인증번호가 일치합니다." });
    } else {
        console.log("인증번호 불일치");
        res.json({ ok: false, msg: "인증번호가 일치하지 않습니다." });
    }
};

// GET /user/searchId
exports.getSearchId = async (req, res) => {
    res.render("user/searchId");
};

// POST /user/searchId
exports.postSearchId = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ where: { email: email } });
        if (user === null) {
            console.log("존재하지 않는 이메일 ", email);
            res.send({ ok: false });
        } else {
            console.log("가입 이메일과 일치 ", user);
            res.send({ ok: true, id: user.id });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send("서버 오류");
    }
};

// GET /searchPw
exports.getSearchPw = async (req, res) => {
    res.render("user/searchPw");
};

// POST /searchPw
exports.postSearchPw = async (req, res) => {
    const { id } = req.body;

    try {
        const user = await User.findOne({ where: { id: id } });
        if (user === null) {
            console.log("존재하지 않는 아이디 ", id);
            res.send({ ok: false });
        } else {
            console.log("존재하는 아이디 ", user);
            res.send({ ok: true, id: user.id });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send("서버 오류");
    }
};

// POST /user/alterPw
exports.alterPw = async (req, res) => {
    const { id, pw } = req.body;
    try {
        const user = await User.findOne({ where: { id: id } });
        if (!user) {
            return res.status(404).json({ ok: false, error: "사용자를 찾을 수 없습니다." });
        }
        const hashedPassword = await bcrypt.hash(pw, 10);
        // Update the user's password
        user.pw = hashedPassword;
        await user.save();
        console.log("변경된 비밀번호 >> ", user.pw);
        return res.status(200).json({ ok: true, message: "비밀번호 변경 성공" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, error: "비밀번호 변경 실패" });
    }
}


// 무한 스크롤
// GET /load-more
exports.loadMoreData = async (req, res) => {
    try {
        const { page = 1, lastRestIndex = 0 } = req.query; // 현재 페이지와 마지막 레스토랑의 인덱스를 쿼리 매개변수에서 가져옴
        const perPage = 9; // 페이지당 항목 수
        const offset = (page - 1) * perPage; // OFFSET 계산

        // 데이터베이스에서 해당 페이지의 데이터와 리뷰를 가져오는 쿼리 실행
        const restaurants = await Restaurant.findAll({
            attributes: ["rest_index", "rest_name"],
            where: {
                rest_index: { [Op.gt]: lastRestIndex } // 이전 페이지에서 마지막으로 가져온 레스토랑 인덱스보다 큰 인덱스만 가져옴
            },
            offset: offset,
            limit: perPage,
            include: {
                model: Review,
                attributes: ["review_rating"],
            }
        });

        res.status(200).json({ restaurants: restaurants }); // 레스토랑과 리뷰 데이터를 응답으로 보냄
    } catch (error) {
        console.error("데이터 가져오기 오류:", error);
        res.status(500).send("Internal Server Error");
    }
};
